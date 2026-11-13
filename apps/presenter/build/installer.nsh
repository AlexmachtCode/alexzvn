; JM Presenter: PDF anbieten (#299), nie übernehmen.
; Kein Schreiben auf den Standardwert von Software\Classes\.pdf, kein UserChoice.
!define JM_PDF_PROGID "${APP_ID}.pdf"
!define JM_CAPS "Software\Jakobs Medien\${PRODUCT_NAME}\Capabilities"

!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}" "" "PDF-Dokument"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "${JM_PDF_PROGID}" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".pdf" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHELL_CONTEXT "${JM_CAPS}" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "${JM_CAPS}" "ApplicationDescription" "PDFs und Präsentationen vorführen"
  WriteRegStr SHELL_CONTEXT "${JM_CAPS}\FileAssociations" ".pdf" "${JM_PDF_PROGID}"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}" "${JM_CAPS}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.pdf\OpenWithProgids" "${JM_PDF_PROGID}"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\${JM_PDF_PROGID}"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
    DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}"
    DeleteRegKey SHELL_CONTEXT "Software\Jakobs Medien\${PRODUCT_NAME}"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Jakobs Medien"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${endIf}
!macroend
