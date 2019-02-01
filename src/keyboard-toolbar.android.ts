import { android as AndroidApp } from "tns-core-modules/application";
import { screen } from "tns-core-modules/platform";
import { View } from "tns-core-modules/ui/core/view";
import { AnimationCurve } from "tns-core-modules/ui/enums";
import { topmost } from "tns-core-modules/ui/frame";
import { ad } from "tns-core-modules/utils/utils";
import { ToolbarBase } from "./keyboard-toolbar.common";

export class Toolbar extends ToolbarBase {
  private startPositionY: number;
  private lastHeight: number;
  private navbarHeight: number;
  private navbarHeightWhenKeyboardOpen: number;
  private isNavbarVisible: boolean;
  private lastKeyboardHeight: number;
  private onGlobalLayoutListener: android.view.ViewTreeObserver.OnGlobalLayoutListener;
  private thePage: any;

  // private onScrollChangedListener: android.view.ViewTreeObserver.OnScrollChangedListener;

  constructor() {
    super();
    this.verticalAlignment = "top"; // weird but true
  }

  protected _loaded(): void {
    setTimeout(() => this.applyInitialPosition());

    setTimeout(() => {
      this.thePage = topmost().currentPage;
      const forView = <View>this.thePage.getViewById(this.forId);

      if (!forView) {
        console.log(`\n⌨ ⌨ ⌨ Please make sure forId="<view id>" resolves to a visible view, or the toolbar won't render correctly! Example: <Toolbar forId="myId" height="44">\n\n`);
        return;
      }

      const parent = <View>this.content.parent;

      forView.on("focus", () => {
        this.hasFocus = true;
        if (that.lastKeyboardHeight) {
          this.showToolbar(parent);
        }
      });

      forView.on("blur", () => {
        this.hasFocus = false;
        this.hideToolbar(parent);
      });
    }, 500);

    const that = this;

    /*
    this.onScrollChangedListener = new android.view.ViewTreeObserver.OnScrollChangedListener({
      onScrollChanged(): void {
        console.log(">> scroll changed");
      }
    });
    */

    this.onGlobalLayoutListener = new android.view.ViewTreeObserver.OnGlobalLayoutListener({
      onGlobalLayout(): void {
        // this can happen during livesync - no problemo
        if (!that.content.android) {
          return;
        }

        const rect = new android.graphics.Rect();
        that.content.android.getWindowVisibleDisplayFrame(rect);

        const newKeyboardHeight = (Toolbar.getUsableScreenSizeY() - rect.bottom) / screen.mainScreen.scale;
        if (newKeyboardHeight <= 0 && that.lastKeyboardHeight === undefined) {
          return;
        }

        if (newKeyboardHeight === that.lastKeyboardHeight) {
          return;
        }

        // TODO see if orientation needs to be accounted for: https://github.com/siebeprojects/samples-keyboardheight/blob/c6f8aded59447748266515afeb9c54cf8e666610/app/src/main/java/com/siebeprojects/samples/keyboardheight/KeyboardHeightProvider.java#L163
        that.lastKeyboardHeight = newKeyboardHeight;

        if (that.hasFocus) {
          if (newKeyboardHeight <= 0) {
            that.hideToolbar(that.content.parent);
          } else {
            that.showToolbar(that.content.parent);
          }
        }
      }
    });

    that.content.android.getViewTreeObserver().addOnGlobalLayoutListener(that.onGlobalLayoutListener);
    // that.content.android.getViewTreeObserver().addOnScrollChangedListener(that.onScrollChangedListener);
  }

  protected _unloaded(): void {
    this.content.android.getViewTreeObserver().removeOnGlobalLayoutListener(this.onGlobalLayoutListener);
    // this.content.android.getViewTreeObserver().removeOnScrollChangedListener(this.onScrollChangedListener);
    this.onGlobalLayoutListener = undefined;
    // this.onScrollChangedListener = undefined;
  }

  private showToolbar(parent): void {
    let navbarHeight = this.isNavbarVisible ? 0 : this.navbarHeight;

    // some devices (Samsung S8) with a hidden virtual navbar show the navbar when the keyboard is open, so subtract its height
    if (!this.isNavbarVisible) {
      const isNavbarVisibleWhenKeyboardOpen = (this.thePage.getMeasuredHeight() < Toolbar.getUsableScreenSizeY() && Toolbar.hasPermanentMenuKey());
      if (isNavbarVisibleWhenKeyboardOpen) {
        // caching for (very minor) performance reasons
        if (!this.navbarHeightWhenKeyboardOpen) {
          this.navbarHeightWhenKeyboardOpen = Toolbar.getNavbarHeightWhenKeyboardOpen();
        }
        navbarHeight = this.navbarHeightWhenKeyboardOpen;
      }
    }

    const animateToY = this.startPositionY - this.lastKeyboardHeight - (this.showWhenKeyboardHidden === true ? 0 : (this.lastHeight / screen.mainScreen.scale)) - navbarHeight;

    parent.animate({
      translate: {x: 0, y: animateToY},
      curve: AnimationCurve.cubicBezier(.32, .49, .56, 1),
      duration: 370
    }).then(() => {
    });
  }

  private hideToolbar(parent): void {
    const animateToY = this.showWhenKeyboardHidden === true && this.showAtBottomWhenKeyboardHidden !== true ? 0 : (this.startPositionY + this.navbarHeight);
    // console.log("hideToolbar, animateToY: " + animateToY);
    parent.animate({
      translate: {x: 0, y: animateToY},
      curve: AnimationCurve.cubicBezier(.32, .49, .56, 1), // perhaps make this one a little different as it's the same as the 'show' animation
      duration: 370
    }).then(() => {
    });
  }

  private applyInitialPosition(): void {
    if (this.startPositionY !== undefined) {
      return;
    }

    const parent = <View>this.content.parent;

    // at this point, topmost().currentPage is null, so do it like this:
    this.thePage = parent;
    while (!this.thePage && !this.thePage.frame) {
      this.thePage = this.thePage.parent;
    }

    const {y} = parent.getLocationOnScreen();
    const newHeight = parent.getMeasuredHeight();

    // this is the bottom navbar - which may be hidden by the user.. so figure out its actual height
    this.navbarHeight = Toolbar.getNavbarHeight();
    this.isNavbarVisible = !!this.navbarHeight;

    this.startPositionY = screen.mainScreen.heightDIPs - y - ((this.showWhenKeyboardHidden === true ? newHeight : 0) / screen.mainScreen.scale) - (this.isNavbarVisible ? this.navbarHeight : 0);

    if (this.lastHeight === undefined) {
      // this moves the keyboardview to the bottom (just move it offscreen/toggle visibility(?) if the user doesn't want to show it without the keyboard being up)
      if (this.showWhenKeyboardHidden === true) {
        if (this.showAtBottomWhenKeyboardHidden === true) {
          parent.translateY = this.startPositionY;
        }
      } else {
        parent.translateY = this.startPositionY + this.navbarHeight;
      }
    } else if (this.lastHeight !== newHeight) {
      parent.translateY = this.startPositionY + this.navbarHeight;
    }
    this.lastHeight = newHeight;
  }

  private static getNavbarHeight() {
    // detect correct height from: https://shiv19.com/how-to-get-android-navbar-height-nativescript-vanilla/
    const context = (<android.content.Context>ad.getApplicationContext());
    let navBarHeight = 0;
    let windowManager = context.getSystemService(android.content.Context.WINDOW_SERVICE);
    let d = windowManager.getDefaultDisplay();

    let realDisplayMetrics = new android.util.DisplayMetrics();
    d.getRealMetrics(realDisplayMetrics);

    let realHeight = realDisplayMetrics.heightPixels;
    let realWidth = realDisplayMetrics.widthPixels;

    let displayMetrics = new android.util.DisplayMetrics();
    d.getMetrics(displayMetrics);

    let displayHeight = displayMetrics.heightPixels;
    let displayWidth = displayMetrics.widthPixels;

    if ((realHeight - displayHeight) > 0) { // Portrait
      navBarHeight = realHeight - displayHeight;
    } else if ((realWidth - displayWidth) > 0) { // Landscape
      navBarHeight = realWidth - displayWidth;
    }

    // Convert to device independent pixels and return
    return navBarHeight / context.getResources().getDisplayMetrics().density;
  }

  private static getNavbarHeightWhenKeyboardOpen() {
    const resources = (<android.content.Context>ad.getApplicationContext()).getResources();
    const resourceId = resources.getIdentifier("navigation_bar_height", "dimen", "android");
    if (resourceId > 0) {
      return resources.getDimensionPixelSize(resourceId) / screen.mainScreen.scale;
    }
    return 0;
  }

  private static hasPermanentMenuKey() {
    return android.view.ViewConfiguration.get(<android.content.Context>ad.getApplicationContext()).hasPermanentMenuKey();
  }

  private static getUsableScreenSizeY(): number {
    const screenSize = new android.graphics.Point();
    AndroidApp.foregroundActivity.getWindowManager().getDefaultDisplay().getSize(screenSize);
    return screenSize.y;
  }
}
