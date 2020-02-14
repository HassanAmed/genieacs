/**
#####################################    File Description    #######################################

This  file implements functions for parsing expression type like parsing logical operators, compari-
son operators escapes characters etc. Deep understanding of
function of this file is not necessary as we know what these function ought to do and can just consi-
der this file as parser for expression type 


See file description of expression.ts in common folder to what and why expression.ts are used.

####################################################################################################
 */


import * as parsimmon from "parsimmon";
import { Expression } from "../types";

/**  
* @description Turn escaped characters into real ones (e.g. "\\n" becomes "\n").
*/
function interpretEscapes(str): string {
  const escapes = {
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t"
  };
  return str.replace(/\\(u[0-9a-fA-F]{4}|[^u])/, (_, escape) => {
    const type = escape.charAt(0);
    const hex = escape.slice(1);
    if (type === "u") return String.fromCharCode(parseInt(hex, 16));

    if (escapes.hasOwnProperty(type)) return escapes[type];

    return type;
  });
}
/**
 * The map() method creates a new array with the results of calling a function for every array element.
 * The map() method calls the provided function once for each element in an array, in order.
 *  * @param exp 
 * @param callback 
 */
export function map(exp, callback): Expression {
  if (!Array.isArray(exp)) return callback(exp);

  let clone;
  for (let i = 1; i < exp.length; ++i) {
    const sub = map(exp[i], callback);
    if (sub !== exp[i]) {
      clone = clone || exp.slice();
      clone[i] = sub;
    }
  }

  return callback(clone || exp);
}
/**
 * @description same as map() asynchronously
 */
export async function mapAsync(exp, callback): Promise<Expression> {
  if (!Array.isArray(exp)) return callback(exp);

  let clone;
  for (let i = 1; i < exp.length; ++i) {
    const sub = await mapAsync(exp[i], callback);
    if (sub !== exp[i]) {
      clone = clone || exp.slice();
      clone[i] = sub;
    }
  }

  return callback(clone || exp);
}

function binaryLeft(operatorsParser, nextParser): parsimmon.Parser<{}> {
  return parsimmon.seqMap(
    nextParser,
    parsimmon.seq(operatorsParser, nextParser).many(),
    (first, rest) =>
      rest.reduce((acc, ch) => {
        const [op, another] = ch;
        if (Array.isArray(acc) && op === acc[0]) return acc.concat([another]);
        if (Array.isArray(another) && op === another[0])
          return [op, acc].concat(another.slice(1));
        return [op, acc, another];
      }, first)
  );
}

const lang = parsimmon.createLanguage({
  ComparisonOperator: function() {
    return parsimmon
      .alt(
        parsimmon.string(">="),
        parsimmon.string("<>"),
        parsimmon.string("<="),
        parsimmon.string("="),
        parsimmon.string(">"),
        parsimmon.string("<")
      )
      .skip(parsimmon.optWhitespace);
  },
  LikeOperator: function() {
    return parsimmon
      .alt(
        parsimmon
          .regexp(/like/i)
          .result("LIKE")
          .desc("LIKE"),
        parsimmon
          .regexp(/not\s+like/i)
          .result("NOT LIKE")
          .desc("NOT LIKE")
      )
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace);
  },
  IsNullOperator: function() {
    return parsimmon
      .alt(
        parsimmon
          .regexp(/is\s+null/i)
          .result("IS NULL")
          .desc("IS NULL"),
        parsimmon
          .regexp(/is\s+not\s+null/i)
          .result("IS NOT NULL")
          .desc("IS NOT NULL")
      )
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace);
  },
  NotOperator: function() {
    return parsimmon
      .regexp(/not/i)
      .result("NOT")
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace)
      .desc("NOT");
  },
  AndOperator: function() {
    return parsimmon
      .regexp(/and/i)
      .result("AND")
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace)
      .desc("AND");
  },
  OrOperator: function() {
    return parsimmon
      .regexp(/or/i)
      .result("OR")
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace)
      .desc("OR");
  },
  Parameter: function(r) {
    return parsimmon
      .alt(
        parsimmon.regexp(/[a-zA-Z0-9_.*-]+/),
        r.Expression.wrap(
          parsimmon.string("{").skip(parsimmon.optWhitespace),
          parsimmon.string("}")
        )
      )
      .atLeast(1)
      .map(x => ["PARAM", x.length > 1 ? ["||"].concat(x) : x[0]])
      .skip(parsimmon.optWhitespace)
      .desc("parameter");
  },
  StringValueSql: function() {
    return parsimmon
      .regexp(/'([^']*)'/, 1)
      .atLeast(1)
      .skip(parsimmon.optWhitespace)
      .map(s => s.join("'"))
      .desc("string");
  },
  StringValueJs: function() {
    return parsimmon
      .regexp(/"((?:\\.|.)*?)"/, 1)
      .skip(parsimmon.optWhitespace)
      .map(interpretEscapes)
      .desc("string");
  },
  NumberValue: function() {
    return parsimmon
      .regexp(/-?(0|[1-9][0-9]*)([.][0-9]+)?([eE][+-]?[0-9]+)?/)
      .skip(parsimmon.optWhitespace)
      .map(Number)
      .desc("number");
  },
  BooleanValue: function() {
    return parsimmon
      .alt(
        parsimmon
          .regexp(/true/i)
          .result(true)
          .desc("TRUE"),
        parsimmon
          .regexp(/false/i)
          .result(false)
          .desc("FALSE")
      )
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace);
  },
  NullValue: function() {
    return parsimmon
      .regexp(/null/i)
      .notFollowedBy(parsimmon.regexp(/[a-zA-Z0-9_]/))
      .skip(parsimmon.optWhitespace)
      .result(null)
      .desc("NULL");
  },
  FuncValue: function(r) {
    return parsimmon.seqMap(
      parsimmon
        .regexp(/([a-zA-Z0-9_]+)/, 1)
        .skip(parsimmon.optWhitespace)
        .desc("function"),
      r.ValueExpression.sepBy(
        parsimmon.string(",").skip(parsimmon.optWhitespace)
      ).wrap(
        parsimmon.string("(").skip(parsimmon.optWhitespace),
        parsimmon.string(")").skip(parsimmon.optWhitespace)
      ),
      (f, args) => ["FUNC", f.toUpperCase()].concat(args)
    );
  },
  Value: function(r) {
    return parsimmon.alt(
      r.NullValue,
      r.BooleanValue,
      r.NumberValue,
      r.StringValueSql,
      r.StringValueJs,
      r.FuncValue
    );
  },
  ValueExpression: function(r) {
    return binaryLeft(
      parsimmon.string("||").skip(parsimmon.optWhitespace),
      binaryLeft(
        parsimmon
          .alt(parsimmon.string("+"), parsimmon.string("-"))
          .skip(parsimmon.optWhitespace),
        binaryLeft(
          parsimmon
            .alt(parsimmon.string("*"), parsimmon.string("/"))
            .skip(parsimmon.optWhitespace),
          parsimmon.alt(
            r.Value,
            r.Parameter,
            r.Expression.wrap(
              parsimmon.string("(").skip(parsimmon.optWhitespace),
              parsimmon.string(")").skip(parsimmon.optWhitespace)
            )
          )
        )
      )
    );
  },
  Comparison: function(r) {
    return parsimmon.alt(
      parsimmon.seqMap(r.ValueExpression, r.IsNullOperator, (p, o) => [o, p]),
      parsimmon.seqMap(
        r.ValueExpression,
        r.ComparisonOperator,
        r.ValueExpression,
        (p, o, v) => [o, p, v]
      ),
      parsimmon.seqMap(
        r.ValueExpression,
        r.LikeOperator,
        r.ValueExpression.skip(
          parsimmon
            .regexp(/escape/i)
            .result("ESCAPE")
            .skip(parsimmon.whitespace)
            .desc("ESCAPE")
        ),
        r.ValueExpression,
        (a, b, c, d) => [b, a, c, d]
      ),
      parsimmon.seqMap(
        r.ValueExpression,
        r.LikeOperator,
        r.ValueExpression,
        (a, b, c) => [b, a, c]
      )
    );
  },
  Expression: function(r) {
    function unary(operatorsParser, nextParser): parsimmon.Parser<{}> {
      return parsimmon.seq(operatorsParser, nextParser).or(nextParser);
    }

    return binaryLeft(
      r.OrOperator,
      binaryLeft(
        r.AndOperator,
        unary(r.NotOperator, r.Comparison.or(r.ValueExpression))
      )
    ).trim(parsimmon.optWhitespace);
  }
});

export function parse(str: string): Expression {
  if (!str) return null;
  return lang.Expression.tryParse(str);
}

export function stringify(exp, level = 0): string {
  if (!Array.isArray(exp)) return JSON.stringify(exp);

  const opLevels = {
    OR: 10,
    AND: 11,
    NOT: 12,
    "=": 20,
    "<>": 20,
    ">": 20,
    ">=": 20,
    "<": 20,
    "<=": 20,
    LIKE: 20,
    "NOT LIKE": 20,
    "IS NULL": 20,
    "IS NOT NULL": 20,
    "||": 30,
    "+": 31,
    "-": 31,
    "*": 32,
    "/": 32
  };

  const op = exp[0].toUpperCase();

  function wrap(e): string {
    if (opLevels[op] <= level) return `(${e})`;
    else return e;
  }

  if (op === "FUNC") {
    return wrap(
      `${exp[1]}(${exp
        .slice(2)
        .map(e => stringify(e))
        .join(", ")})`
    );
  } else if (op === "PARAM") {
    if (typeof exp[1] === "string") {
      return wrap(exp[1]);
    } else if (Array.isArray(exp[1]) && exp[1][0] === "||") {
      return wrap(
        exp[1]
          .slice(1)
          .map(p => {
            if (typeof p === "string") return p;
            else return `{${stringify(p)}}`;
          })
          .join("")
      );
    } else {
      return wrap(`{${stringify(exp[1])}}`);
    }
  } else if (op === "IS NULL" || op === "IS NOT NULL") {
    return wrap(`${stringify(exp[1], opLevels[op])} ${op}`);
  } else if (op === "LIKE" || op === "NOT LIKE") {
    if (exp[3]) {
      return wrap(
        `${stringify(exp[1], opLevels[op])} ${op} ${stringify(
          exp[2],
          opLevels[op]
        )} ESCAPE ${stringify(exp[3], opLevels[op])}`
      );
    } else {
      return wrap(
        `${stringify(exp[1], opLevels[op])} ${op} ${stringify(
          exp[2],
          opLevels[op]
        )}`
      );
    }
  } else if (op in opLevels) {
    const parts = exp.slice(1).map((e, i) => {
      return stringify(e, opLevels[exp[0]] + Math.min(i - 1, 0));
    });

    if (op === "NOT") return wrap(`${op} ${parts[0]}`);
    else return wrap(parts.join(` ${op} `));
  } else {
    throw new Error(`Unrecognized operator ${exp[0]}`);
  }
}

export function parseLikePattern(pat, esc): string[] {
  const chars = pat.split("");

  for (let i = 0; i < chars.length; ++i) {
    const c = chars[i];
    if (c === esc) {
      chars[i] = chars[i + 1] || "";
      chars[i + 1] = "";
    } else if (c === "_") {
      chars[i] = "\\_";
    } else if (c === "%") {
      chars[i] = "\\%";
      while (chars[i + 1] === "%") chars[++i] = "";
    }
  }
  return chars.filter(c => c);
}
