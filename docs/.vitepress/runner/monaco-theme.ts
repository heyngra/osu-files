type Monaco = any

export function defineMonacoThemes(monaco: Monaco): void {
  const common = (base: 'vs' | 'vs-dark', rules: any[], colors: Record<string, string>) => ({ base, inherit: true, rules, colors })
  const latte = common('vs', [
    { token: 'comment', foreground: '#6c6f85', fontStyle: 'italic' },
    { token: 'keyword', foreground: '#8839ef' }, { token: 'keyword.control', foreground: '#8839ef' },
    { token: 'string', foreground: '#40a02b' }, { token: 'string.quote', foreground: '#40a02b' }, { token: 'string.escape', foreground: '#ea76cb' },
    { token: 'number', foreground: '#fe640b' }, { token: 'constant', foreground: '#fe640b' },
    { token: 'type', foreground: '#1e66f5' }, { token: 'type.identifier', foreground: '#1e66f5' }, { token: 'key', foreground: '#1e66f5' },
    { token: 'identifier', foreground: '#4c4f69' }, { token: 'variable', foreground: '#4c4f69' }, { token: 'parameter', foreground: '#4c4f69' }, { token: 'property', foreground: '#4c4f69' },
    { token: 'function', foreground: '#1e66f5' }, { token: 'class', foreground: '#df8e1d' },
    { token: 'operator', foreground: '#179299' }, { token: 'delimiter', foreground: '#7c7f93' }, { token: 'delimiter.bracket', foreground: '#7c7f93' },
    { token: 'tag', foreground: '#d20f39' }, { token: 'attribute.name', foreground: '#40a02b' }, { token: 'attribute.value', foreground: '#8839ef' },
    { token: 'regexp', foreground: '#df8e1d' },
  ], {
    'editor.background': '#00000000', 'editorGutter.background': '#00000000',
    'editorLineNumber.foreground': '#9ca0b0', 'editorLineNumber.activeForeground': '#6c6f85',
    'editorCursor.foreground': '#dc8a78', 'editor.selectionBackground': '#bcc0cc55', 'editor.selectionHighlightBackground': '#ccd0da66', 'editor.inactiveSelectionBackground': '#ccd0da44',
    'editor.lineHighlightBackground': '#00000000', 'editorLineHighlight.border': '#00000000',
    'scrollbarSlider.background': '#7c7f9326', 'scrollbarSlider.hoverBackground': '#7c7f934d', 'scrollbarSlider.activeBackground': '#7c7f9370', 'scrollbar.shadow': '#00000000',
    'editorWidget.background': '#e6e9ef', 'editorWidget.border': '#bcc0cc',
    'editorSuggestWidget.background': '#e6e9ef', 'editorSuggestWidget.foreground': '#4c4f69', 'editorSuggestWidget.selectedBackground': '#ccd0da', 'editorSuggestWidget.selectedForeground': '#4c4f69', 'editorSuggestWidget.highlightForeground': '#ea76cb', 'editorSuggestWidget.focusHighlightForeground': '#ea76cb', 'editorSuggestWidget.selectedIconForeground': '#ea76cb', 'editorSuggestWidgetStatus.foreground': '#6c6f85',
    'editorHoverWidget.background': '#e6e9ef', 'editorHoverWidget.foreground': '#4c4f69', 'editorHoverWidget.border': '#bcc0cc', 'editorHoverWidget.highlightForeground': '#ea76cb', 'editorHoverWidget.statusBarBackground': '#dce0e8',
    'focusBorder': '#ea76cb', 'textLink.foreground': '#1e66f5', 'textCodeBlock.background': '#e6e9ef',
    'editorBracketHighlight.foreground1': '#d20f39', 'editorBracketHighlight.foreground2': '#df8e1d', 'editorBracketHighlight.foreground3': '#40a02b', 'editorBracketHighlight.foreground4': '#1e66f5', 'editorBracketHighlight.foreground5': '#8839ef', 'editorBracketHighlight.foreground6': '#ea76cb',
    'editorBracketPairGuide.background1': '#d20f39', 'editorBracketPairGuide.background2': '#df8e1d', 'editorBracketPairGuide.background3': '#40a02b', 'editorBracketPairGuide.background4': '#1e66f5', 'editorBracketPairGuide.background5': '#8839ef', 'editorBracketPairGuide.background6': '#ea76cb',
  })
  const mocha = common('vs-dark', [
    { token: 'comment', foreground: '#6c7086', fontStyle: 'italic' },
    { token: 'keyword', foreground: '#cba6f7' }, { token: 'keyword.control', foreground: '#cba6f7' },
    { token: 'string', foreground: '#a6e3a1' }, { token: 'string.quote', foreground: '#a6e3a1' }, { token: 'string.escape', foreground: '#f5c2e7' },
    { token: 'number', foreground: '#fab387' }, { token: 'constant', foreground: '#fab387' },
    { token: 'type', foreground: '#89b4fa' }, { token: 'type.identifier', foreground: '#89b4fa' }, { token: 'key', foreground: '#89b4fa' },
    { token: 'identifier', foreground: '#cdd6f4' }, { token: 'variable', foreground: '#cdd6f4' }, { token: 'parameter', foreground: '#cdd6f4' }, { token: 'property', foreground: '#cdd6f4' },
    { token: 'function', foreground: '#89b4fa' }, { token: 'class', foreground: '#f9e2af' },
    { token: 'operator', foreground: '#94e2d5' }, { token: 'delimiter', foreground: '#9399b2' }, { token: 'delimiter.bracket', foreground: '#9399b2' },
    { token: 'tag', foreground: '#f38ba8' }, { token: 'attribute.name', foreground: '#a6e3a1' }, { token: 'attribute.value', foreground: '#cba6f7' },
    { token: 'regexp', foreground: '#f9e2af' },
  ], {
    'editor.background': '#00000000', 'editorGutter.background': '#00000000',
    'editorLineNumber.foreground': '#585b70', 'editorLineNumber.activeForeground': '#a6adc8',
    'editorCursor.foreground': '#f5e0dc', 'editor.selectionBackground': '#45475a99', 'editor.selectionHighlightBackground': '#31324466', 'editor.inactiveSelectionBackground': '#31324444',
    'editor.lineHighlightBackground': '#00000000', 'editorLineHighlight.border': '#00000000',
    'scrollbarSlider.background': '#6c708626', 'scrollbarSlider.hoverBackground': '#6c70864d', 'scrollbarSlider.activeBackground': '#6c708670', 'scrollbar.shadow': '#00000000',
    'editorWidget.background': '#313244', 'editorWidget.border': '#45475a',
    'editorSuggestWidget.background': '#1e1e2e', 'editorSuggestWidget.foreground': '#cdd6f4', 'editorSuggestWidget.selectedBackground': '#313244', 'editorSuggestWidget.selectedForeground': '#f5c2e7', 'editorSuggestWidget.highlightForeground': '#f5c2e7', 'editorSuggestWidget.focusHighlightForeground': '#f5c2e7', 'editorSuggestWidget.selectedIconForeground': '#f5c2e7', 'editorSuggestWidgetStatus.foreground': '#a6adc8',
    'editorHoverWidget.background': '#1e1e2e', 'editorHoverWidget.foreground': '#cdd6f4', 'editorHoverWidget.border': '#45475a', 'editorHoverWidget.highlightForeground': '#f5c2e7', 'editorHoverWidget.statusBarBackground': '#181825',
    'focusBorder': '#f5c2e7', 'textLink.foreground': '#89b4fa', 'textCodeBlock.background': '#181825',
    'editorBracketHighlight.foreground1': '#f38ba8', 'editorBracketHighlight.foreground2': '#f9e2af', 'editorBracketHighlight.foreground3': '#a6e3a1', 'editorBracketHighlight.foreground4': '#89b4fa', 'editorBracketHighlight.foreground5': '#cba6f7', 'editorBracketHighlight.foreground6': '#f5c2e7',
    'editorBracketPairGuide.background1': '#f38ba8', 'editorBracketPairGuide.background2': '#f9e2af', 'editorBracketPairGuide.background3': '#a6e3a1', 'editorBracketPairGuide.background4': '#89b4fa', 'editorBracketPairGuide.background5': '#cba6f7', 'editorBracketPairGuide.background6': '#f5c2e7',
  })
  monaco.editor.defineTheme('osu-files-light', latte)
  monaco.editor.defineTheme('osu-files-dark', mocha)
}
