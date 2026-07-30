// The Bella 2 interpreter.
//
// Bella 2 is strongly typed but dynamically typed, so every operator inspects the
// runtime type of its operands and throws on a mismatch rather than coercing.
//
// Interpretation is purely functional. Expressions are interpreted against a
// memory and yield a value; statements are interpreted against a [memory, output]
// state pair and yield a new state. Nothing is ever mutated in place, which makes
// the implementation line up directly with the denotational semantics.

type BuiltInFunction = (...args: Value[]) => Value;

/**
 * A function declared in Bella 2 source: a parameter list plus the single
 * expression that forms its body.
 *
 * This is a class rather than the tuple `[Identifier[], Expression]` so that a
 * user function can never be mistaken for an ordinary Bella array. With the
 * tuple representation the array literal `[[1, 2], 3]` is structurally
 * indistinguishable from a one-parameter function, and `isUserFunction` reports
 * true for it.
 */
export class UserFunction {
  constructor(
    public parameters: Identifier[],
    public expression: Expression
  ) {}
}

export type Value = number | boolean | Value[] | BuiltInFunction | UserFunction;

export type Memory = Map<string, Value>;
export type Output = Value[];
export type State = [Memory, Output];

// Custom type guards

function isUserFunction(v: Value): v is UserFunction {
  return v instanceof UserFunction;
}

function isBuiltInFunction(v: Value): v is BuiltInFunction {
  return typeof v === "function";
}

function isArray(v: Value): v is Value[] {
  return Array.isArray(v);
}

// Runtime type checks. Each returns the value narrowed to the expected type so
// that operators can be written as a single expression.

function checkNumber(v: Value): number {
  if (typeof v !== "number") {
    throw new Error("Expected a number");
  }
  return v;
}

function checkBoolean(v: Value): boolean {
  if (typeof v !== "boolean") {
    throw new Error("Expected a boolean");
  }
  return v;
}

/**
 * Equality is defined only on the primitive domains, and only between operands
 * of the same type. Arrays and functions are not comparable, so `==` never
 * silently degrades into reference identity.
 */
function checkComparable(left: Value, right: Value): void {
  const type = typeof left;
  if ((type !== "number" && type !== "boolean") || type !== typeof right) {
    throw new Error("Equality requires two numbers or two booleans");
  }
}

/**
 * Lifts a host numeric function into the standard library, giving it the arity
 * and operand checking that the rest of the language enforces.
 */
function numericFunction(
  f: (...args: number[]) => number,
  arity: number
): BuiltInFunction {
  return (...args: Value[]) => {
    if (args.length !== arity) {
      throw new Error("Wrong number of arguments");
    }
    return f(...args.map(checkNumber));
  };
}

// Standard library

export const standardLibrary: ReadonlyMap<string, Value> = new Map<
  string,
  Value
>([
  ["pi", Math.PI],
  ["sqrt", numericFunction(Math.sqrt, 1)],
  ["sin", numericFunction(Math.sin, 1)],
  ["cos", numericFunction(Math.cos, 1)],
  ["ln", numericFunction(Math.log, 1)],
  ["exp", numericFunction(Math.exp, 1)],
  ["hypot", numericFunction(Math.hypot, 2)],
]);

// Expressions

export interface Expression {
  interpret(m: Memory): Value;
}

export class Numeral implements Expression {
  constructor(public value: number) {}
  interpret(_: Memory): Value {
    return this.value;
  }
}

export class BooleanLiteral implements Expression {
  constructor(public value: boolean) {}
  interpret(_: Memory): Value {
    return this.value;
  }
}

export class Identifier implements Expression {
  constructor(public name: string) {}
  interpret(m: Memory): Value {
    const value = m.get(this.name);
    if (value === undefined) {
      throw new Error(`Identifier ${this.name} was undeclared`);
    }
    return value;
  }
}

export class UnaryExpression implements Expression {
  constructor(
    public operator: string,
    public expression: Expression
  ) {}
  interpret(m: Memory): Value {
    const value = this.expression.interpret(m);
    switch (this.operator) {
      case "-":
        return -checkNumber(value);
      case "!":
        return !checkBoolean(value);
      default:
        throw new Error(`Unknown unary operator ${this.operator}`);
    }
  }
}

export class BinaryExpression implements Expression {
  constructor(
    public operator: string,
    public left: Expression,
    public right: Expression
  ) {}
  interpret(m: Memory): Value {
    // The logical operators short circuit, so they are handled before either
    // operand is interpreted. Every other operator is strict in both operands.
    if (this.operator === "&&") {
      return checkBoolean(this.left.interpret(m))
        ? checkBoolean(this.right.interpret(m))
        : false;
    }
    if (this.operator === "||") {
      return checkBoolean(this.left.interpret(m))
        ? true
        : checkBoolean(this.right.interpret(m));
    }
    const left = this.left.interpret(m);
    const right = this.right.interpret(m);
    switch (this.operator) {
      case "+":
        return checkNumber(left) + checkNumber(right);
      case "-":
        return checkNumber(left) - checkNumber(right);
      case "*":
        return checkNumber(left) * checkNumber(right);
      case "/":
        return checkNumber(left) / checkNumber(right);
      case "%":
        return checkNumber(left) % checkNumber(right);
      case "**":
        return checkNumber(left) ** checkNumber(right);
      case "<":
        return checkNumber(left) < checkNumber(right);
      case "<=":
        return checkNumber(left) <= checkNumber(right);
      case ">=":
        return checkNumber(left) >= checkNumber(right);
      case ">":
        return checkNumber(left) > checkNumber(right);
      case "==":
        checkComparable(left, right);
        return left === right;
      case "!=":
        checkComparable(left, right);
        return left !== right;
      default:
        throw new Error(`Unknown binary operator ${this.operator}`);
    }
  }
}

export class Call implements Expression {
  constructor(
    public callee: Identifier,
    public args: Expression[]
  ) {}
  interpret(m: Memory): Value {
    const functionValue = m.get(this.callee.name);
    const argValues = this.args.map((arg) => arg.interpret(m));
    if (functionValue === undefined) {
      throw new Error(`Identifier ${this.callee.name} was undeclared`);
    } else if (isUserFunction(functionValue)) {
      const { parameters, expression } = functionValue;
      if (parameters.length !== this.args.length) {
        throw new Error("Wrong number of arguments");
      }
      const locals = parameters.map((p, i) => [p.name, argValues[i]!] as const);
      return expression.interpret(new Map([...m, ...locals]));
    } else if (isBuiltInFunction(functionValue)) {
      return functionValue(...argValues);
    } else {
      throw new Error("Not a function");
    }
  }
}

export class ConditionalExpression implements Expression {
  constructor(
    public test: Expression,
    public consequent: Expression,
    public alternate: Expression
  ) {}
  interpret(m: Memory): Value {
    // Only the selected arm is interpreted.
    return checkBoolean(this.test.interpret(m))
      ? this.consequent.interpret(m)
      : this.alternate.interpret(m);
  }
}

export class ArrayLiteral implements Expression {
  constructor(public elements: Expression[]) {}
  interpret(m: Memory): Value {
    return this.elements.map((element) => element.interpret(m));
  }
}

export class SubscriptExpression implements Expression {
  constructor(
    public array: Expression,
    public subscript: Expression
  ) {}
  interpret(m: Memory): Value {
    const array = this.array.interpret(m);
    if (!isArray(array)) {
      throw new Error("Subscripted value is not an array");
    }
    const index = checkNumber(this.subscript.interpret(m));
    if (!Number.isInteger(index) || index < 0 || index >= array.length) {
      throw new Error("Array index out of bounds");
    }
    return array[index]!;
  }
}

// Statements

export interface Statement {
  interpret([m, o]: State): State;
}

export class VariableDeclaration implements Statement {
  constructor(
    public id: Identifier,
    public expression: Expression
  ) {}
  interpret([m, o]: State): State {
    if (m.has(this.id.name)) {
      throw new Error(`Identifier ${this.id.name} already declared`);
    }
    return [new Map([...m, [this.id.name, this.expression.interpret(m)]]), o];
  }
}

export class FunctionDeclaration implements Statement {
  constructor(
    public id: Identifier,
    public parameters: Identifier[],
    public expression: Expression
  ) {}
  interpret([m, o]: State): State {
    if (m.has(this.id.name)) {
      throw new Error(`Identifier ${this.id.name} already declared`);
    }
    const fun = new UserFunction(this.parameters, this.expression);
    return [new Map<string, Value>([...m, [this.id.name, fun]]), o];
  }
}

export class Assignment implements Statement {
  constructor(
    public id: Identifier,
    public expression: Expression
  ) {}
  interpret([m, o]: State): State {
    const current = m.get(this.id.name);
    if (current === undefined) {
      throw new Error(`Identifier ${this.id.name} was undeclared`);
    }
    if (isUserFunction(current) || isBuiltInFunction(current)) {
      throw new Error("Cannot assign to a function");
    }
    return [new Map([...m, [this.id.name, this.expression.interpret(m)]]), o];
  }
}

export class PrintStatement implements Statement {
  constructor(public expression: Expression) {}
  interpret([m, o]: State): State {
    return [m, [...o, this.expression.interpret(m)]];
  }
}

export class WhileStatement implements Statement {
  constructor(
    public expression: Expression,
    public block: Block
  ) {}
  interpret([m, o]: State): State {
    let memory = m;
    let output = o;
    while (checkBoolean(this.expression.interpret(memory))) {
      const [blockMemory, blockOutput] = this.block.interpret([memory, output]);
      // The body is a new scope: assignments to variables that already existed
      // survive the iteration, but declarations made inside the body do not.
      // Without this, a `let` in the body would fail as already declared on the
      // second time around.
      memory = new Map(
        [...memory].map(([name]) => [name, blockMemory.get(name)!] as const)
      );
      output = blockOutput;
    }
    return [memory, output];
  }
}

// Block

export class Block {
  constructor(public statements: Statement[]) {}
  interpret([m, o]: State): State {
    let state: State = [m, o];
    for (let statement of this.statements) {
      state = statement.interpret(state);
    }
    return state;
  }
}

// Program

export class Program {
  constructor(public block: Block) {}
  interpret(): Output {
    const initialMemory: Memory = new Map(standardLibrary);
    const [_, o] = this.block.interpret([initialMemory, []]);
    return o;
  }
}

export function interpret(p: Program): Output {
  return p.interpret();
}
