// Defines the factory functions for building a structured program representation
// (an abstract syntax "tree") for Bella 2.
//
// The nodes themselves are the classes in interpreter.ts, each of which knows how
// to interpret itself. This module is the construction layer on top of them: one
// small function per production of the abstract syntax, so that building a
// program reads like the grammar instead of like a wall of `new`.

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
import type { Expression, Statement } from "./interpreter.ts";

// Re-exported so that this module is a complete entry point: a client can build
// a program and run it without also reaching into interpreter.ts.
export { interpret, standardLibrary } from "./interpreter.ts";
export type { Memory, Output, State, Value } from "./interpreter.ts";

// -------- STRUCTURE --------

// p: Program = program b
export function program(block: Block): Program {
  return new Program(block);
}

// b: Block = block s*
export function block(statements: Statement[]): Block {
  return new Block(statements);
}

// -------- STATEMENTS --------

// s = let i = e
export function varDecl(name: string, initializer: Expression): VariableDeclaration {
  return new VariableDeclaration(identifier(name), initializer);
}

// s = func i i* = e
export function functionDecl(
  name: string,
  parameters: string[],
  body: Expression
): FunctionDeclaration {
  return new FunctionDeclaration(identifier(name), parameters.map(identifier), body);
}

// s = i = e
export function assignStmt(target: string, source: Expression): Assignment {
  return new Assignment(identifier(target), source);
}

// s = print e
export function printStmt(argument: Expression): PrintStatement {
  return new PrintStatement(argument);
}

// s = while e b
export function whileStmt(test: Expression, body: Block): WhileStatement {
  return new WhileStatement(test, body);
}

// -------- EXPRESSIONS --------

// e = n
export function numeral(value: number): Numeral {
  return new Numeral(value);
}

// e = true | false
export function booleanLiteral(value: boolean): BooleanLiteral {
  return new BooleanLiteral(value);
}

// e = i
export function identifier(name: string): Identifier {
  return new Identifier(name);
}

// e = uop e
export function unaryExp(operator: string, argument: Expression): UnaryExpression {
  return new UnaryExpression(operator, argument);
}

// e = e1 bop e2. Written left-to-right so that a call reads as infix.
export function binaryExp(
  left: Expression,
  operator: string,
  right: Expression
): BinaryExpression {
  return new BinaryExpression(operator, left, right);
}

// e = i e*
export function functionCall(callee: string, args: Expression[]): Call {
  return new Call(identifier(callee), args);
}

// e = e ? e1 : e2
export function conditionalExp(
  test: Expression,
  consequent: Expression,
  alternate: Expression
): ConditionalExpression {
  return new ConditionalExpression(test, consequent, alternate);
}

// e = [ e* ]
export function arrayLiteral(elements: Expression[]): ArrayLiteral {
  return new ArrayLiteral(elements);
}

// e = e [ e ]
export function subscriptExp(array: Expression, index: Expression): SubscriptExpression {
  return new SubscriptExpression(array, index);
}
