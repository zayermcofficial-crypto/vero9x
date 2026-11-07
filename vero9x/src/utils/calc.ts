/** Safe arithmetic evaluator (no eval). Supports + - * / % ^ ( ) unary minus and decimals. */
export function calculate(input: string): number {
  const src = input.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  if (!src || src.length > 100) throw new Error('Expression is empty or too long.');
  if (!/^[0-9+\-*/%^().]+$/.test(src)) throw new Error('Only numbers and + - * / % ^ ( ) are allowed.');
  let pos = 0;
  const peek = () => src[pos];
  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = src[pos++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term(): number {
    let v = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = src[pos++]; const r = power();
      if ((op === '/' || op === '%') && r === 0) throw new Error('Division by zero.');
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function power(): number {
    const base = unary();
    if (peek() === '^') { pos++; return Math.pow(base, power()); }
    return base;
  }
  function unary(): number {
    if (peek() === '-') { pos++; return -unary(); }
    if (peek() === '+') { pos++; return unary(); }
    return atom();
  }
  function atom(): number {
    if (peek() === '(') {
      pos++; const v = expr();
      if (peek() !== ')') throw new Error('Missing closing parenthesis.');
      pos++; return v;
    }
    const m = /^\d*\.?\d+/.exec(src.slice(pos)) ?? /^\d+\.?/.exec(src.slice(pos));
    if (!m) throw new Error('Invalid expression.');
    pos += m[0].length;
    return parseFloat(m[0]);
  }
  const result = expr();
  if (pos !== src.length) throw new Error('Invalid expression.');
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number.');
  return result;
}
