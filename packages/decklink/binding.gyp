{
  "targets": [
    {
      "target_name": "jm_decklink",
      # DeckLinkAPI_i.c traegt die COM-GUIDs. Es gibt KEINE Import-Bibliothek —
      # anders als beim NDI-SDK. Beide Dateien erzeugt scripts/generate-idl.mjs.
      "sources": ["src/addon.cc", "generated/DeckLinkAPI_i.c"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "generated"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "NOMINMAX", "WIN32_LEAN_AND_MEAN"],
      "conditions": [
        ["OS=='win'", {
          # ole32: CoInitializeEx/CoCreateInstance. oleaut32: SysStringLen/SysFreeString (BSTR).
          "libraries": ["ole32.lib", "oleaut32.lib"]
        }]
      ]
    }
  ]
}
