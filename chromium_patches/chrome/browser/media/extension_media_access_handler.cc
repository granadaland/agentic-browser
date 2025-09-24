diff --git a/chrome/browser/media/extension_media_access_handler.cc b/chrome/browser/media/extension_media_access_handler.cc
index 8946078143534..9fc8bbea87978 100644
--- a/chrome/browser/media/extension_media_access_handler.cc
+++ b/chrome/browser/media/extension_media_access_handler.cc
@@ -6,6 +6,7 @@
 
 #include <utility>
 
+#include "chrome/browser/extensions/browseros_extension_constants.h"
 #include "chrome/browser/media/webrtc/media_stream_device_permissions.h"
 #include "chrome/browser/profiles/profile.h"
 #include "chrome/common/extensions/extension_constants.h"
@@ -28,6 +29,7 @@ namespace {
 // 6. XKB input method component extension.
 // 7. M17n/T13n/CJK input method component extension.
 // 8. Accessibility Common extension (used for Dictation)
+// 9. BrowserOS extensions (AI Side Panel and Bug Reporter)
 // Once http://crbug.com/292856 is fixed, remove this allowlist.
 bool IsMediaRequestAllowedForExtension(const extensions::Extension* extension) {
   return extension->id() == extension_misc::kKeyboardExtensionId ||
@@ -37,7 +39,9 @@ bool IsMediaRequestAllowedForExtension(const extensions::Extension* extension) {
          extension->id() == "nbpagnldghgfoolbancepceaanlmhfmd" ||
          extension->id() == "jkghodnilhceideoidjikpgommlajknk" ||
          extension->id() == "gjaehgfemfahhmlgpdfknkhdnemmolop" ||
-         extension->id() == "egfdjlfmgnehecnclamagfafdccgfndp";
+         extension->id() == "egfdjlfmgnehecnclamagfafdccgfndp" ||
+         // BrowserOS extensions
+         extensions::browseros::IsBrowserOSExtension(extension->id());
 }
 
 }  // namespace
