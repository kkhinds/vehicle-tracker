; Vehicle Tracker installer extras.
;
; Windows caches shortcut and taskbar icons per target path. An update writes a
; new exe to the same path, so the desktop tile and taskbar keep showing the
; previous artwork until the shell is told to look again — SHCNE_ASSOCCHANGED
; plus an icon-cache rebuild fixes that. ie4uinit is Windows 8 and up; the
; second flag is a no-op where it isn't recognised.

!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -ClearIconCache'
!macroend

!macro customUnInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend
