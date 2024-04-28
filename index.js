//©2024 - BestLang - BestDeveloper - BestMat, Inc. - All rights reserved
import vm from "vm";

class SrcLoc {
    constructor(pos, line, call, file) {
        this.pos = pos;
        this.line = line;
        this.call = call;
        this.file = file;
    }

    static new(pos, line, call, file) {
        return new SrcLoc(pos, line, call, file);
    }
}

const TokenTypes = {
    Number: "Number",
    String: "String",
    Boolean: "Boolean",
    Keyword: "Keyword",
    Nil: "Nil"
};

class Token {
    constructor(type, value, srcloc) {
        this.type = type;
        this.value = value;
        this.srcloc = srcloc;
      }
    
      static new(type, value, srcloc) {
        return new Token(type, value, srcloc);
      }
}

const isDot = (ch) => /\./.test(ch);
const isDigit = (ch) => /\d/.test(ch);
const isWhitespace = (ch) => /\s/.test(ch);
const isSemicolon = (ch) => /;/.test(ch);
const isNewline = (ch) => /\n/.test(ch);
const isDash = (ch) => /\-/.test(ch);
const isDoubleQuote = (ch) => /"/.test(ch);
const isColon = (ch) => /:/.test(ch);
const isSymbolStart = (ch) => /[=<>%:|?\\/*\p{L}_$!+-]/u.test(ch);
const isSymbolChar = (ch) => /[:=@~<>%:&|?\\/^*&#'\p{L}\p{N}_$!+-]/u.test(ch);

const isNumber = (str) => /^[+-]?\d+(\.\d+)?$/.test(str);
const isBoolean = (str) => /true|false/.test(str);
const isNil = (str) => /nil/.test(str);

class InputStream {
    constructor(input, file) {
        this.input = input;
        this.file = file;
        this.pos = 0;
        this.line = 1;
        this.col = 1;
    }

    static new(input, file) {
        return new InputStream(input, file);
    }

    get length() {
        return this.input.length;
    }

    eof() {
        return this.pos >= this.length;
    }

    lookahead(n = 1) {
        return this.input[this.pos + n];
    }

    next() {
        const ch = this.input[this.pos++];
    
        if (isNewline(ch)) {
          this.line++;
          this.col = 1;
        } else {
          this.col++;
        }
    
        return ch;
    }

    peek() {
        return this.input[this.pos];
    }

    readWhile(pred) {
        let str = "";
        while (pred(this.peek())) {
          str += this.next();
        }
    
        return str;
      }
}

class Exception extends Error {
    constructor(message) {
        super(message);
    }
} 

class SyntaxException extends Exception {
    constructor(value, srcloc) {
        super(
          `BestLang: Syntax Exception: invalid syntax ${value} found at ${srcloc.file} (${srcloc.line}:${srcloc.col}).`
        );
     }
}

class Lexer {
    constructor(input) {
        this.input = input;
    }

    static new(input) {
        return new Lexer(input);
    }

    readNumber() {
        let { pos, line, col, file } = this.input;
        const srcloc = SrcLoc.new(pos, line, col, file);
        let num = "";
    
        if (isDash(this.input.peek())) {
          num += this.input.next();
        }
    
        num += this.input.readWhile((ch) => isDigit(ch) || isDot(ch));
    
        if (!isNumber(num)) {
          throw new SyntaxException(num, srcloc);
        }
    
        return Token.new(TokenTypes.Number, num, srcloc);
    }

    tokenize() {
        let tokens = [];

        while (!this.input.eof()) {
          let ch = this.input.peek();

          if (isWhitespace(ch)) {
            this.input.readWhile(isWhitespace);
          } else if (isSemicolon(ch)) {
            this.input.readWhile((ch) => !isNewline(ch) && !this.input.eof());
          } else if (isDash(ch) && isDigit(this.input.lookahead(1))) {
            tokens.push(this.readNumber());
          } else if (isDigit(ch)) {
            tokens.push(this.readNumber());
          } else if (isDoubleQuote(ch)) {
            tokens.push(this.readString());
          } else if (isColon(ch)) {
            tokens.push(this.readKeyword());
          } else if (isSymbolStart(ch)) {
            tokens.push(this.readSymbol());
          } else {
            const { pos, line, col, file } = this.input;
            
            throw new SyntaxException(ch, SrcLoc.new(pos, line, col, file));
          }
        }
    
        return tokens;
    }

    readString() {
        let { pos, line, col, file } = this.input;
        const srcloc = SrcLoc.new(pos, line, col, file);
        let str = this.input.next();
    
        str += this.readEscaped();
        return Token.new(TokenTypes.String, str, srcloc);
    }

    readEscaped() {
        let str = "";
        let escaped = false;
        let ended = false;
    
        while (!this.input.eof()) {
          let ch = this.input.next();
    
          if (escaped) {
            str += this.readEscapeSequence(ch);
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (isDoubleQuote(ch)) {
            ended = true;
            str += ch;
            break;
          } else if (ch === "\n") {
            throw new Exception(
              "Unexpected newline in nonterminated single-line string literal"
            );
          } else if (ch === "`") {
            str += "\\`";
          } else {
            str += ch;
          }
        }
    
        if (!ended && this.input.eof()) {
          throw new Exception(
            "Expected double quote to close string literal; got EOF"
          );
        }
    
        return str;
    }

    readEscapeSequence(c) {
        let str = "";
        let seq = "";
    
        if (c === "n") {
          str += "\n";
        } else if (c === "b") {
          str += "\b";
        } else if (c === "f") {
          str += "\f";
        } else if (c === "r") {
          str += "\r";
        } else if (c === "t") {
          str += "\t";
        } else if (c === "v") {
          str += "\v";
        } else if (c === "0") {
          str += "\0";
        } else if (c === "'") {
          str += "'";
        } else if (c === '"') {
          str += '"';
        } else if (c === "\\") {
          str += "\\";
        } else if (c === "u" || c === "U") {
          seq += this.input.readWhile(isHexDigit);
          str += String.fromCodePoint(parseInt(seq, 16));
        }
    
        return str;
    }

    readKeyword() {
        let { pos, line, col, file } = this.input;
        const srcloc = SrcLoc.new(pos, line, col, file);
        const kw = this.input.next() + this.input.readWhile(isSymbolChar);
    
        return Token.new(TokenTypes.Keyword, kw, srcloc);
    }

    readSymbol() {
        let { pos, line, col, file } = this.input;
        const srcloc = SrcLoc.new(pos, line, col, file);
        const sym = this.input.readWhile(isSymbolChar);
    
        if (isBoolean(sym)) {
          return Token.new(TokenTypes.Boolean, sym, srcloc);
        } else if (isNil(sym)) {
          return Token.new(TokenTypes.Nil, sym, srcloc);
        }
    
        throw new SyntaxException(sym, srcloc);
    }
}

function tokenize(input, file) {
    return Lexer.new(InputStream.new(input, file)).tokenize();
}

class Reader {
    constructor(tokens){ 
        this.tokens = tokens;
        this.pos = 0;
    }

    static new(tokens) {
        return new Reader(tokens);
    }
    
    get length() {
        return this.tokens.length;
    }

    eof() {
        return this.pos >= this.length;
    }
    
    next() {
        return this.tokens[this.pos++];
    }
    
    peek() {
        return this.tokens[this.pos];
    }
    
    skip() {
        this.pos++;
    }
}

const readAtom = (reader) => {
    const tok = reader.peek();
  
    switch (tok.type) {
      case TokenTypes.Number:
        reader.skip();
        return tok;
      case TokenTypes.String:
        reader.skip();
        return tok;
      case TokenTypes.Boolean:
        reader.skip();
        return tok;
      case TokenTypes.Keyword:
        reader.skip();
        return tok;
      case TokenTypes.Nil:
        reader.skip();
        return tok;
      default:
        throw new SyntaxException(tok.value, tok.srcloc);
    }
};

function readForm(reader) {
    return readAtom(reader);
}

function read (tokens) {
    const reader = Reader.new(tokens);
    let parseTree = [];
  
    while (!reader.eof()) {
        parseTree.push(readForm(reader));
    }
  
    return parseTree;
};

const expand = parseTree => parseTree;

const ASTTypes = {
    Program: "Program",
    NumberLiteral: "NumberLiteral",
    StringLiteral: "StringLiteral",
    BooleanLiteral: "BooleanLiteral",
    KeywordLiteral: "KeywordLiteral",
    NilLiteral: "NilLiteral",
}

const AST = {
    Program(exprs) {
        return {
            type: ASTTypes.Program,
            body: exprs,
            srcloc: exprs[0]?.srcloc ?? SrcLoc.new(0, 0, 0, "none"),
        };
    },

    NumberLiteral(token) {
        return {
            type: ASTTypes.NumberLiteral,
            value: token.value,
            srcloc: token.srcloc,
      };
    },

    StringLiteral(token) {
        return {
          type: ASTTypes.StringLiteral,
          value: token.value,
          srcloc: token.srcloc,
        };
    },

    BooleanLiteral(token) {
        return {
          type: ASTTypes.BooleanLiteral,
          value: token.value,
          srcloc: token.srcloc,
        };
    },

    KeywordLiteral(token) {
        return {
          type: ASTTypes.KeywordLiteral,
          value: token.value,
          srcloc: token.srcloc,
        };
    },

    NilLiteral(token) {
        return {
          type: ASTTypes.NilLiteral,
          value: token.value,
          srcloc: token.srcloc,
        };
    }
};

function parsePrimitive (reader) {
    const token = reader.peek();
  
    switch (token.type) {
      case TokenTypes.Number:
        reader.skip();
        return AST.NumberLiteral(token);
      case TokenTypes.String:
        reader.skip();
        return AST.StringLiteral(token);
      case TokenTypes.Boolean:
        reader.skip();
        return AST.BooleanLiteral(token);
      case TokenTypes.Keyword:
        reader.skip();
        return AST.KeywordLiteral(token);
      case TokenTypes.Nil:
        reader.skip();
        return AST.NilLiteral(token);
      default:
        throw new SyntaxException(token.value, token.srcloc);
    }
  };

function parseExpr(reader) {
    return parsePrimitive(reader);
};
  
function parse (readTree) {
    let body = [];
    const reader = Reader.new(readTree);
  
    while (!reader.eof()) {
        body.push(parseExpr(reader));
    }
  
    return AST.Program(body);
};

const desugar = ast => ast;

export class Emitter {
    constructor(program) {
        this.program = program;
    }
  
    static new(program) {
        return new Emitter(program);
    }
  
    emit(node = this.program) {
        switch (node.type) {
          case ASTTypes.Program:
            return this.emitProgram(node);
          case ASTTypes.NumberLiteral:
            return this.emitNumber(node);
          case ASTTypes.StringLiteral:
            return this.emitString(node);
          case ASTTypes.BooleanLiteral:
            return this.emitBoolean(node);
          case ASTTypes.KeywordLiteral:
            return this.emitKeyword(node);
          case ASTTypes.NilLiteral:
            return this.emitNil(node);
          default:
            throw new SyntaxException(node.type, node.srcloc);
        }
    }
  
    emitNumber(node) {
        return node.value;
    }
  
    emitProgram(node) {
        let code = "";
  
        for (let n of node.body) {
            code += this.emit(n);
        }
  
        return code;
    }

    emitBoolean(node) {
        return node.value;
    }

    emitKeyword(node) {
        return `Symbol.for("${node.value}")`;
    }

    emitNil(node) {
        return "null";
    }

    emitString(node) {
        return "`" + node.value.slice(1, -1) + "`";
    }
}

const emit = (ast) => Emitter.new(ast).emit();
function compile(input, file = "stdin") {
    return emit(desugar(parse(expand(read(tokenize(input, file))))));
}

function EVAL(input) {
    vm.runInThisContext(compile(input));
}

function printString (value, withQuotes) {
    switch (typeof value) {
      case "number":
        return String(value);
      case "string":
        return withQuotes ? `"${value}"` : value;
      case "symbol":
        return value.description;
      case "boolean":
        return String(value);
      case "undefined":
        return "nil";
      case "object":
        if (value === null) {
          return "nil";
        }
      default:
        throw new Exception(`Invalid print value ${value}`);
    }
};

class ASTPrinter {
    constructor(program) {
      this.program = program;
    }
  
    static new(program) {
      return new ASTPrinter(program);
    }

    printPrimitive(node, indent) {
        return `${" ".repeat(indent)}${node.type}: ${
          node.type === "NilLiteral" ? "nil" : node.value
        }`;
    }

    printProgram(node, indent) {
        let pStr = "";
    
        for (let n of node.body) {
          pStr += this.print(n, indent);
          +"\n";
        }
    
        return pStr;
    }

    print(node = this.program, indent = 0) {
        switch (node.type) {
          case ASTTypes.Program:
            return this.printProgram(node, indent);
          case ASTTypes.NumberLiteral:
          case ASTTypes.StringLiteral:
          case ASTTypes.BooleanLiteral:
          case ASTTypes.KeywordLiteral:
          case ASTTypes.NilLiteral:
            return this.printPrimitive(node, indent);
        }
    }
}

const printAST = (ast) => ASTPrinter.new(ast).print();

import readlineSync from "readline-sync";

const READ = (prompt) => readlineSync.question(prompt);
const pprintDesugaredAST = (input, file = "stdin") => printAST(desugar(parse(expand(read(tokenize(input, file))))));

const pprintAST = (input, file = "stdin") => printAST(parse(expand(read(tokenize(input, file)))));

const fail = (msg, exn = Exception) => {
    throw new exn(msg);
};

export const repl = (mode) => {
    const proc =
        mode === "repl"
        ? EVAL
        : mode === "printDesugared"
        ? pprintDesugaredAST
        : mode === "printAST"
        ? pprintAST
        : fail("Invalid REPL mode specified");

    let prompt = "bestlang > ";

    while (true) {
        try {
            const input = READ(prompt);
      
            if (input === "quit") {
              process.exit(0);
            }
      
            let result = proc(input);
      
            console.log(result, mode === "repl");
          } catch (e) {
            console.error(e.message);
          }
    }
};

export const run = () => {
    let mode = "";
    switch (process.argv[2]) {
      case "print":
        if (process.argv[3] === "-d") {
          mode = "printDesugared";
          break;
        } else if (process.argv[3] === "-a") {
          mode = "printAST";
          break;
        }
      case undefined:
      case "-i":
      case "repl":
        mode = "repl";
        break;
      default:
        throw new Exception("Invalid command specified");
    }
    
    repl(mode);
};