package com.texttoimage.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = this.bridge;
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            if (webView != null) {
                webView.getSettings().setAllowFileAccess(true);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setDatabaseEnabled(true);
                webView.getSettings().setAllowContentAccess(true);
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);

                webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                    android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                    intent.setData(android.net.Uri.parse(url));
                    startActivity(intent);
                });
            }
        }
    }
}
