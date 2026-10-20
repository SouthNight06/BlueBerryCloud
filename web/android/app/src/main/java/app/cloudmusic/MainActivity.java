package app.cloudmusic;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.widget.ImageView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final long SPLASH_HOLD_MS = 1100L;
    private static final long SPLASH_FADE_MS = 260L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private ImageView splashView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) {
            return;
        }
        showSplash();
        handler.postDelayed(this::hideSplash, SPLASH_HOLD_MS);
    }

    private void showSplash() {
        ImageView view = new ImageView(this);
        view.setScaleType(ImageView.ScaleType.CENTER_CROP);
        view.setBackgroundColor(Color.parseColor("#6EBEF3"));
        view.setImageResource(R.drawable.splash);
        splashView = view;
        addContentView(view, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void hideSplash() {
        final ImageView view = splashView;
        if (view == null) {
            return;
        }
        splashView = null;
        view.animate()
                .alpha(0f)
                .setDuration(SPLASH_FADE_MS)
                .withEndAction(() -> {
                    ViewGroup parent = (ViewGroup) view.getParent();
                    if (parent != null) {
                        parent.removeView(view);
                    }
                })
                .start();
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
