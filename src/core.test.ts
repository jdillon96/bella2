import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arrayLiteral,
  assignStmt,
  binaryExp,
  block,
  booleanLiteral,
  conditionalExp,
  functionCall,
  functionDecl,
  identifier,
  numeral,
  printStmt,
  interpret,
  program,
  standardLibrary,
  subscriptExp,
  unaryExp,
  varDecl,
  whileStmt,
} from "./core.ts";
import {
  ArrayLiteral,
  Assignment,
  BinaryExpression,
  Block,
  BooleanLiteral,
  Call,
  ConditionalExpression,
  FunctionDeclaration,
  Identifier,
  Numeral,
  PrintStatement,
  Program,
  SubscriptExpression,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from "./interpreter.ts";

describe("structure factories", () => {
  it("builds a program", () => {
    const body = block([]);
    const p = program(body);
    assert.ok(p instanceof Program);
    assert.equal(p.block, body);
  });

  it("builds a block", () => {
    const statements = [printStmt(numeral(1))];
    const b = block(statements);
    assert.ok(b instanceof Block);
    assert.equal(b.statements, statements);
  });
});

describe("statement factories", () => {
  it("builds a variable declaration", () => {
    const initializer = numeral(1);
    const s = varDecl("x", initializer);
    assert.ok(s instanceof VariableDeclaration);
    assert.equal(s.id.name, "x");
    assert.equal(s.expression, initializer);
  });

  it("builds a function declaration", () => {
    const body = numeral(1);
    const s = functionDecl("f", ["a", "b"], body);
    assert.ok(s instanceof FunctionDeclaration);
    assert.equal(s.id.name, "f");
    assert.deepEqual(
      s.parameters.map((p) => p.name),
      ["a", "b"]
    );
    assert.equal(s.expression, body);
  });

  it("builds an assignment", () => {
    const source = numeral(1);
    const s = assignStmt("x", source);
    assert.ok(s instanceof Assignment);
    assert.equal(s.id.name, "x");
    assert.equal(s.expression, source);
  });

  it("builds a print statement", () => {
    const argument = numeral(1);
    const s = printStmt(argument);
    assert.ok(s instanceof PrintStatement);
    assert.equal(s.expression, argument);
  });

  it("builds a while statement", () => {
    const test = booleanLiteral(false);
    const body = block([]);
    const s = whileStmt(test, body);
    assert.ok(s instanceof WhileStatement);
    assert.equal(s.expression, test);
    assert.equal(s.block, body);
  });
});

describe("expression factories", () => {
  it("builds a numeral", () => {
    const e = numeral(7);
    assert.ok(e instanceof Numeral);
    assert.equal(e.value, 7);
  });

  it("builds a boolean literal", () => {
    const e = booleanLiteral(true);
    assert.ok(e instanceof BooleanLiteral);
    assert.equal(e.value, true);
  });

  it("builds an identifier", () => {
    const e = identifier("x");
    assert.ok(e instanceof Identifier);
    assert.equal(e.name, "x");
  });

  it("builds a unary expression", () => {
    const argument = numeral(1);
    const e = unaryExp("-", argument);
    assert.ok(e instanceof UnaryExpression);
    assert.equal(e.operator, "-");
    assert.equal(e.expression, argument);
  });

  it("builds a binary expression from its infix reading", () => {
    const left = numeral(1);
    const right = numeral(2);
    const e = binaryExp(left, "+", right);
    assert.ok(e instanceof BinaryExpression);
    assert.equal(e.operator, "+");
    assert.equal(e.left, left);
    assert.equal(e.right, right);
  });

  it("builds a call", () => {
    const args = [numeral(1)];
    const e = functionCall("f", args);
    assert.ok(e instanceof Call);
    assert.equal(e.callee.name, "f");
    assert.equal(e.args, args);
  });

  it("builds a conditional expression", () => {
    const test = booleanLiteral(true);
    const consequent = numeral(1);
    const alternate = numeral(2);
    const e = conditionalExp(test, consequent, alternate);
    assert.ok(e instanceof ConditionalExpression);
    assert.equal(e.test, test);
    assert.equal(e.consequent, consequent);
    assert.equal(e.alternate, alternate);
  });

  it("builds an array literal", () => {
    const elements = [numeral(1)];
    const e = arrayLiteral(elements);
    assert.ok(e instanceof ArrayLiteral);
    assert.equal(e.elements, elements);
  });

  it("builds a subscript expression", () => {
    const array = arrayLiteral([numeral(1)]);
    const index = numeral(0);
    const e = subscriptExp(array, index);
    assert.ok(e instanceof SubscriptExpression);
    assert.equal(e.array, array);
    assert.equal(e.subscript, index);
  });
});

describe("re-exports", () => {
  it("exposes the standard library", () => {
    assert.equal(standardLibrary.get("pi"), Math.PI);
  });

  it("exposes interpret, so this module is a complete entry point", () => {
    assert.deepEqual(interpret(program(block([printStmt(numeral(5))]))), [5]);
  });
});
