// Keep the disposal symbol available for runtimes older than native Explicit Resource Management.
const symbols = Symbol as SymbolConstructor & { dispose?: symbol }
if (!symbols.dispose)
  Object.defineProperty(Symbol, 'dispose', { configurable: false, enumerable: false, value: Symbol.for('Symbol.dispose') })
