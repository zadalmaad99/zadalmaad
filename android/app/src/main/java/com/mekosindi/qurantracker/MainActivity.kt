package com.mekosindi.qurantracker

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.os.Environment
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.File

/**
 * Exposed to the web app as `window.AndroidApp`. A page running inside a
 * plain browser never sees this object, so the JS side can feature-detect it
 * and only offer the "open Downloads" button when it will actually work.
 */
class WebAppBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun openDownloadsFolder() {
        activity.runOnUiThread { activity.openDownloadsFolder() }
    }
}

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private val appUrl by lazy { getString(R.string.app_url) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            // Always fetch a fresh copy so app updates (deployed via GitHub Pages)
            // show up immediately instead of an old cached bundle.
            cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
            setSupportZoom(false)
            builtInZoomControls = false
            mediaPlaybackRequiresUserGesture = false
        }

        webView.addJavascriptInterface(WebAppBridge(this), "AndroidApp")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                // Keep all navigation (incl. Google sign-in redirects) inside the WebView.
                return false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                swipeRefresh.isRefreshing = false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) ProgressBar.VISIBLE else ProgressBar.GONE
            }
        }

        swipeRefresh.setOnRefreshListener { webView.reload() }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl(appUrl)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    /**
     * Opens the system's own Downloads screen/app. Tries the dedicated
     * DownloadManager screen first (what most Android skins show as the
     * "Downloads" app), then falls back to a file browser pointed at the
     * public Downloads directory, then to the Downloads content provider —
     * covering the range of behavior across Android versions and OEM skins.
     */
    fun openDownloadsFolder() {
        val attempts = listOf(
            { startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)) },
            {
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", dir)
                startActivity(
                    Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "resource/folder")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            },
            {
                startActivity(
                    Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(
                            android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                            "vnd.android.cursor.dir/downloads"
                        )
                    }
                )
            }
        )

        for (attempt in attempts) {
            try {
                attempt()
                return
            } catch (_: ActivityNotFoundException) {
                // try the next strategy
            } catch (_: Exception) {
                // provider/permission issue on this device — try the next strategy
            }
        }

        Toast.makeText(this, "افتح تطبيق «الملفات» ثم مجلّد Downloads", Toast.LENGTH_LONG).show()
    }
}
