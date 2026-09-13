package cn.iepose.astrbot;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * AstroBot Control — 手机上的机器人任务控制台。
 * 本地 WebView 壳:加载 assets/www,放行跨域以便直连任意 AstrBot 实例。
 */
public class MainActivity extends Activity {

    private WebView web;
    private long lastBack = 0L;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowContentAccess(true);
        s.setAllowUniversalAccessFromFileURLs(true); // 绕过 CORS,直连用户自建实例
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // 支持 http:// 局域网服务器
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.setBackgroundColor(0xFFF2F2F7);
        // JS 桥:网页深色模式切换时同步系统状态栏颜色(用静态嵌套类,成员内部类会触发 build-tools 34 d8 的 NPE bug)
        web.addJavascriptInterface(new ThemeBridge(this), "AndroidBridge");
        web.addJavascriptInterface(new UpdateBridge(this, web), "UpdateBridge");
        web.setWebViewClient(new ExtWebViewClient(this));
        // 优先加载热更新副本(filesDir/www),没有则用 APK 内置 assets;随后静默检查新版本
        web.loadUrl(Updater.indexUrl(this));
        Updater.autoCheck(this, web);
    }

    /** JS 桥:网页主题切换 → 同步安卓状态栏/导航栏颜色 */
    private static class ThemeBridge {
        private final Activity host;

        ThemeBridge(Activity host) { this.host = host; }

        @android.webkit.JavascriptInterface
        public void setDark(final boolean dark) {
            host.runOnUiThread(() -> {
                android.view.Window w = host.getWindow();
                if (dark) {
                    w.setStatusBarColor(0xFF000000);
                    w.setNavigationBarColor(0xFF1C1C1E);
                    w.getDecorView().setSystemUiVisibility(0);
                } else {
                    w.setStatusBarColor(0xFFF2F2F7);
                    w.setNavigationBarColor(0xFFF9F9FB);
                    w.getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                }
            });
        }
    }

    /** 外部链接交给系统浏览器,应用本体留在 WebView。注:用命名类,匿名类会触发 build-tools 34 d8 的 NPE bug。 */
    private static class ExtWebViewClient extends WebViewClient {
        private final Activity host;

        ExtWebViewClient(Activity host) { this.host = host; }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
            Uri u = request.getUrl();
            String url = u.toString();
            if (url.startsWith("file://")) return false;
            try {
                host.startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (Exception ignored) {
            }
            return true;
        }
    }

    /**
     * Web 层热更新:GitHub Releases 托管 manifest.json + www.zip,
     * 比对版本后下载解压到 filesDir/www,WebView 下次加载即生效(免重装 APK)。
     */
    private static class Updater {
        static final String BASE =
                "https://github.com/ItzAoneHax/astrobot-control/releases/latest/download/";
        private static final long CHECK_INTERVAL_MS = 12L * 3600_000L; // 静默检查节流

        static String indexUrl(Context ctx) {
            File f = new File(ctx.getFilesDir(), "www/index.html");
            return f.exists() ? Uri.fromFile(f).toString() : "file:///android_asset/www/index.html";
        }

        static SharedPreferences prefs(Context ctx) {
            return ctx.getSharedPreferences("update", Context.MODE_PRIVATE);
        }

        static void autoCheck(final Activity host, final WebView web) {
            SharedPreferences sp = prefs(host);
            long now = System.currentTimeMillis();
            if (now - sp.getLong("last", 0L) < CHECK_INTERVAL_MS) return;
            sp.edit().putLong("last", now).apply();
            check(host, web, false);
        }

        static void check(final Activity host, final WebView web, final boolean manual) {
            new Thread(() -> {
                String payload;
                try {
                    JSONObject m = new JSONObject(fetch(BASE + "manifest.json"));
                    long remote = m.optLong("version", 0L);
                    long local = prefs(host).getLong("web", 0L);
                    if (remote <= local) {
                        payload = "{status:'uptodate',version:" + local + ",manual:" + manual + "}";
                    } else {
                        Context ctx = host.getApplicationContext();
                        File zip = new File(ctx.getCacheDir(), "www.zip");
                        download(BASE + m.optString("zip", "www.zip"), zip);
                        File staging = new File(ctx.getFilesDir(), "www_new");
                        delete(staging);
                        if (!unzip(zip, staging)) throw new IOException("更新包缺少 index.html");
                        File cur = new File(ctx.getFilesDir(), "www");
                        delete(cur);
                        if (!staging.renameTo(cur)) throw new IOException("更新包应用失败");
                        prefs(ctx).edit().putLong("web", remote).apply();
                        zip.delete();
                        payload = "{status:'downloaded',from:" + local + ",to:" + remote
                                + ",note:" + JSONObject.quote(m.optString("note", ""))
                                + ",manual:" + manual + "}";
                    }
                } catch (Exception e) {
                    payload = "{status:'error',message:" + JSONObject.quote(String.valueOf(e.getMessage()))
                            + ",manual:" + manual + "}";
                }
                final String js = "if(window.onUpdateResult) onUpdateResult(" + payload + ")";
                host.runOnUiThread(() -> {
                    try { web.evaluateJavascript(js, null); } catch (Exception ignored) { }
                });
            }, "web-update").start();
        }

        /** GET 到内存,带大小上限(防异常响应撑爆内存) */
        private static byte[] httpGet(String url, int capMb) throws IOException {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(10000);
                c.setReadTimeout(20000);
                c.setInstanceFollowRedirects(true); // releases/latest/download 会 302 到实际资产
                int code = c.getResponseCode();
                if (code != 200) throw new IOException("HTTP " + code);
                InputStream in = c.getInputStream();
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] b = new byte[8192];
                int n;
                while ((n = in.read(b)) > 0) {
                    bo.write(b, 0, n);
                    if (bo.size() > capMb * 1024 * 1024) throw new IOException("文件超过大小上限");
                }
                return bo.toByteArray();
            } finally {
                if (c != null) c.disconnect();
            }
        }

        private static String fetch(String url) throws IOException {
            return new String(httpGet(url, 1), StandardCharsets.UTF_8);
        }

        private static void download(String url, File out) throws IOException {
            byte[] data = httpGet(url, 8); // 更新包目前 ~600KB,8MB 上限留足余量
            OutputStream o = new BufferedOutputStream(new FileOutputStream(out));
            try { o.write(data); } finally { o.close(); }
        }

        /** 解压到 dir;校验条目路径不越界;返回是否包含入口 index.html */
        private static boolean unzip(File zip, File dir) throws IOException {
            boolean hasIndex = false;
            ZipInputStream z = new ZipInputStream(new BufferedInputStream(new FileInputStream(zip)));
            try {
                ZipEntry e;
                byte[] b = new byte[8192];
                String root = dir.getCanonicalPath() + File.separator;
                while ((e = z.getNextEntry()) != null) {
                    File f = new File(dir, e.getName());
                    if (!f.getCanonicalPath().startsWith(root)) continue; // 防路径穿越
                    if (e.isDirectory()) { f.mkdirs(); continue; }
                    File parent = f.getParentFile();
                    if (parent != null) parent.mkdirs();
                    OutputStream o = new BufferedOutputStream(new FileOutputStream(f));
                    try {
                        int n;
                        while ((n = z.read(b)) > 0) o.write(b, 0, n);
                    } finally { o.close(); }
                    if ("index.html".equals(e.getName())) hasIndex = true;
                }
            } finally {
                z.close();
            }
            return hasIndex;
        }

        private static void delete(File f) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) delete(k);
            if (f.exists()) f.delete();
        }
    }

    /** JS 桥:设置页检查应用更新 / 应用已下载的更新 / 查询版本 */
    private static class UpdateBridge {
        private final Activity host;
        private final WebView web;

        UpdateBridge(Activity host, WebView web) { this.host = host; this.web = web; }

        @android.webkit.JavascriptInterface
        public void check() { Updater.check(host, web, true); }

        @android.webkit.JavascriptInterface
        public void apply() {
            host.runOnUiThread(() -> web.loadUrl(Updater.indexUrl(host)));
        }

        @android.webkit.JavascriptInterface
        public String versions() {
            try {
                PackageInfo pi = host.getPackageManager().getPackageInfo(host.getPackageName(), 0);
                JSONObject v = new JSONObject();
                v.put("native", pi.versionName + " (" + pi.versionCode + ")");
                v.put("web", Updater.prefs(host).getLong("web", 0L));
                return v.toString();
            } catch (Exception e) {
                return "{\"native\":\"?\",\"web\":0}";
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (web != null && web.canGoBack()) {
                web.goBack();
                return true;
            }
            long now = System.currentTimeMillis();
            if (now - lastBack < 2200L) {
                finish();
                return true;
            }
            lastBack = now;
            Toast.makeText(this, "再按一次返回键退出控制台", Toast.LENGTH_SHORT).show();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
