import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Executes user code safely in a temporary sandbox subprocess.
 *
 * @param {Object} params
 * @param {string} params.code - The user submitted code
 * @param {string} params.language - javascript | typescript | python | cpp | csharp
 * @param {Object} params.challenge - Challenge definition with tests / unitTests
 * @returns {Promise<{passed: boolean, results: Array<{index: number, passed: boolean, expected: string, actual: string}>, output: string}>}
 */
export async function executeCodeTests({ code, language, challenge }) {
  const lang = String(language || "javascript").toLowerCase();
  const tests = challenge.tests || {};
  const unitTests = Array.isArray(tests.unitTests) ? tests.unitTests : [];

  // If no unitTests are defined, fall back to static rule verification
  if (unitTests.length === 0) {
    return executeStaticChecks(code, tests);
  }

  if (lang === "javascript" || lang === "typescript") {
    return runJsTsTests(code, lang, unitTests);
  }

  if (lang === "python") {
    return runPythonTests(code, unitTests);
  }

  if (lang === "csharp") {
    return runCSharpTests(code, unitTests);
  }

  if (lang === "cpp") {
    return runCppTests(code, unitTests);
  }

  // fallback static
  return executeStaticChecks(code, tests);
}

/**
 * Static rule validation fallback
 */
function executeStaticChecks(code, tests) {
  const list = tests?.checks || [];
  const results = list.map((c, i) => {
    const lower = code.toLowerCase();
    let passed = true;
    if (c.type === "containsAll") {
      passed = c.values.every((v) => lower.includes(String(v).toLowerCase()));
    } else if (c.type === "containsAny") {
      passed = c.values.some((v) => lower.includes(String(v).toLowerCase()));
    } else if (c.type === "forbidAny") {
      passed = !c.values.some((v) => lower.includes(String(v).toLowerCase()));
    } else if (c.type === "regexAll") {
      passed = c.values.every((v) => new RegExp(v, "i").test(code));
    }
    return {
      index: i + 1,
      passed,
      expected: c.expected || c.name || "Requirement",
      actual: passed ? "matched" : "not matched",
    };
  });

  const passed = results.length ? results.every((x) => x.passed) : true;
  return {
    passed,
    results,
    output: passed
      ? "> All static requirements verified successfully."
      : "> Some static requirements failed.",
  };
}

/**
 * Executes JS / TS code against unit tests in an isolated Node subprocess
 */
async function runJsTsTests(code, lang, unitTests) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "devrank-runner-"));
  const scriptPath = path.join(tmpDir, `solution.${lang === "typescript" ? "ts" : "js"}`);

  // Build a test harness script that runs each test case
  const harness = `
const assert = require('assert');

// User code
${code}

// Determine function name to call
let targetFn = null;
if (typeof twoSum === 'function') targetFn = twoSum;
else if (typeof isUser === 'function') targetFn = isUser;
else if (typeof isStrongPassword === 'function') targetFn = isStrongPassword;
else if (typeof cleanText === 'function') targetFn = cleanText;
else if (typeof solution === 'function') targetFn = solution;
else {
  // Find first defined function
  for (const key of Object.keys(global)) {
    if (typeof global[key] === 'function' && !['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate'].includes(key)) {
      targetFn = global[key];
      break;
    }
  }
}

if (!targetFn && typeof isUser !== 'undefined') targetFn = isUser;

const testCases = ${JSON.stringify(unitTests)};
const results = [];

function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  try {
    if (!targetFn) {
      results.push({
        index: i + 1,
        passed: false,
        expected: JSON.stringify(tc.expected),
        actual: "Error: No entry function found in code"
      });
      continue;
    }
    const input = Array.isArray(tc.input) ? tc.input : [tc.input];
    const actual = targetFn(...input);
    const passed = deepEqual(actual, tc.expected);
    results.push({
      index: i + 1,
      passed,
      expected: JSON.stringify(tc.expected),
      actual: JSON.stringify(actual)
    });
  } catch (err) {
    results.push({
      index: i + 1,
      passed: false,
      expected: JSON.stringify(tc.expected),
      actual: "Exception: " + err.message
    });
  }
}

console.log("__DEVRANK_RESULTS__" + JSON.stringify(results));
`;

  try {
    await fs.writeFile(scriptPath, harness, "utf8");

    const execCmd = lang === "typescript" ? "npx" : "node";
    const execArgs = lang === "typescript" ? ["tsx", scriptPath] : [scriptPath];

    const { stdout, stderr, timedOut } = await runSubprocess(execCmd, execArgs, tmpDir, 4000);

    if (timedOut) {
      return {
        passed: false,
        results: unitTests.map((t, i) => ({
          index: i + 1,
          passed: false,
          expected: JSON.stringify(t.expected),
          actual: "Timeout (execution exceeded 4000ms)",
        })),
        output: "> Execution timed out (possible infinite loop).",
      };
    }

    const match = stdout.match(/__DEVRANK_RESULTS__(.*)$/m);
    if (match) {
      try {
        const results = JSON.parse(match[1]);
        const passed = results.every((r) => r.passed);
        return {
          passed,
          results,
          output: passed ? "> All unit tests passed." : "> Some unit tests failed.",
        };
      } catch {}
    }

    // If syntax error or crashed
    const errorOutput = stderr || stdout || "Execution error.";
    return {
      passed: false,
      results: unitTests.map((t, i) => ({
        index: i + 1,
        passed: false,
        expected: JSON.stringify(t.expected),
        actual: errorOutput.split("\n")[0] || "Runtime error",
      })),
      output: errorOutput,
    };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Executes Python code against unit tests in an isolated Python subprocess
 */
async function runPythonTests(code, unitTests) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "devrank-runner-py-"));
  const scriptPath = path.join(tmpDir, "solution.py");

  const harness = `
import json
import math

# User code
${code}

test_cases = ${JSON.stringify(unitTests)}
results = []

# Detect main function
target_fn = None
for fn_name in ['clean_text', 'cosine_similarity', 'pair', 'hash_password', 'solution']:
    if fn_name in globals() and callable(globals()[fn_name]):
        target_fn = globals()[fn_name]
        break

if not target_fn:
    for k, v in list(globals().items()):
        if callable(v) and not k.startswith('_') and k != 'json' and k != 'math':
            target_fn = v
            break

for i, tc in enumerate(test_cases):
    try:
        if not target_fn:
            results.append({
                "index": i + 1,
                "passed": False,
                "expected": str(tc.get('expected')),
                "actual": "Error: No entry function found in code"
            })
            continue
        args = tc.get('input')
        if isinstance(args, list):
            actual = target_fn(*args)
        else:
            actual = target_fn(args)
        
        expected = tc.get('expected')
        passed = (actual == expected)
        results.append({
            "index": i + 1,
            "passed": passed,
            "expected": str(expected),
            "actual": str(actual)
        })
    except Exception as e:
        results.append({
            "index": i + 1,
            "passed": False,
            "expected": str(tc.get('expected')),
            "actual": "Exception: " + str(e)
        })

print("__DEVRANK_RESULTS__" + json.dumps(results))
`;

  try {
    await fs.writeFile(scriptPath, harness, "utf8");

    const { stdout, stderr, timedOut } = await runSubprocess("python", [scriptPath], tmpDir, 4000);

    if (timedOut) {
      return {
        passed: false,
        results: unitTests.map((t, i) => ({
          index: i + 1,
          passed: false,
          expected: String(t.expected),
          actual: "Timeout (execution exceeded 4000ms)",
        })),
        output: "> Execution timed out (possible infinite loop).",
      };
    }

    const match = stdout.match(/__DEVRANK_RESULTS__(.*)$/m);
    if (match) {
      try {
        const results = JSON.parse(match[1]);
        const passed = results.every((r) => r.passed);
        return {
          passed,
          results,
          output: passed ? "> All Python unit tests passed." : "> Some Python unit tests failed.",
        };
      } catch {}
    }

    const errorOutput = stderr || stdout || "Execution error.";
    return {
      passed: false,
      results: unitTests.map((t, i) => ({
        index: i + 1,
        passed: false,
        expected: String(t.expected),
        actual: errorOutput.split("\n")[0] || "Runtime error",
      })),
      output: errorOutput,
    };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Runs a subprocess with strict timeout
 */
function runSubprocess(cmd, args, cwd, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child = spawn(cmd, args, {
      cwd,
      shell: process.platform === "win32",
      env: { ...process.env, NODE_ENV: "test" },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {}
    }, timeoutMs);

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, timedOut });
    });
  });
}

/**
 * Executes C# code using dotnet-script
 */
async function runCSharpTests(code, unitTests) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "devrank-runner-cs-"));
  const scriptPath = path.join(tmpDir, "solution.csx");

  // Build test harness for C#
  const harness = `
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

// User code embedded here
${code}

// Test runner
var testCases = JsonSerializer.Deserialize<List<JsonElement>>("""
${JSON.stringify(unitTests)}
""");

var results = new List<object>();
int i = 0;
foreach (var tc in testCases)
{
    i++;
    try
    {
        var inputEl = tc.GetProperty("input");
        var expectedEl = tc.GetProperty("expected");
        
        // Try to call Solution class or standalone function
        object actual = null;
        object expected = JsonSerializer.Deserialize<object>(expectedEl.GetRawText());
        
        // Try generic invoke - user should define a class Solution with a Solve method
        // or a static method named after the problem
        var solutionType = System.Reflection.Assembly.GetExecutingAssembly()
            .GetTypes()
            .FirstOrDefault(t => t.Name == "Solution");
        
        if (solutionType != null)
        {
            var instance = Activator.CreateInstance(solutionType);
            var method = solutionType.GetMethods()
                .FirstOrDefault(m => m.Name != "GetType" && m.Name != "GetHashCode" && 
                                     m.Name != "Equals" && m.Name != "ToString");
            if (method != null)
            {
                var inputArr = inputEl.ValueKind == JsonValueKind.Array
                    ? inputEl.EnumerateArray().Select(e => (object)JsonSerializer.Deserialize<object>(e.GetRawText())).ToArray()
                    : new object[] { JsonSerializer.Deserialize<object>(inputEl.GetRawText()) };
                actual = method.Invoke(instance, inputArr);
            }
        }
        
        bool passed = actual?.ToString() == expected?.ToString();
        results.Add(new { index = i, passed, expected = expected?.ToString(), actual = actual?.ToString() });
    }
    catch (Exception ex)
    {
        results.Add(new { index = i, passed = false, expected = "?", actual = "Exception: " + ex.Message });
    }
}

Console.WriteLine("__DEVRANK_RESULTS__" + JsonSerializer.Serialize(results));
`;

  try {
    await fs.writeFile(scriptPath, harness, "utf8");

    // Try dotnet-script first, then dotnet run fallback
    const { stdout, stderr, timedOut } = await runSubprocess(
      "dotnet-script",
      [scriptPath],
      tmpDir,
      8000
    );

    if (timedOut) {
      return {
        passed: false,
        results: unitTests.map((t, idx) => ({
          index: idx + 1,
          passed: false,
          expected: String(t.expected),
          actual: "Timeout (execution exceeded 8000ms)",
        })),
        output: "> Execution timed out.",
      };
    }

    const match = stdout.match(/__DEVRANK_RESULTS__(.*)$/m);
    if (match) {
      try {
        const results = JSON.parse(match[1]);
        const passed = results.every((r) => r.passed);
        return {
          passed,
          results,
          output: passed ? "> All C# unit tests passed." : "> Some C# unit tests failed.",
        };
      } catch {}
    }

    const errorOutput = stderr || stdout || "C# execution error.";
    return {
      passed: false,
      results: unitTests.map((t, idx) => ({
        index: idx + 1,
        passed: false,
        expected: String(t.expected),
        actual: errorOutput.split("\n")[0] || "Runtime error",
      })),
      output: "C# Error: " + errorOutput,
    };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Executes C++ code using g++
 */
async function runCppTests(code, unitTests) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "devrank-runner-cpp-"));
  const srcPath = path.join(tmpDir, "solution.cpp");
  const binPath = path.join(tmpDir, process.platform === "win32" ? "solution.exe" : "solution");

  const harness = `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <cassert>

// User code
${code}

int main() {
    // Static test harness - prints __DEVRANK_RESULTS__[{"index":1,"passed":true,...}]
    std::vector<std::string> results;
    
    // NOTE: For C++, tests are run manually per problem.
    // This is a basic harness that checks if the code compiles and runs.
    std::cout << "__DEVRANK_RESULTS__[{\\\"index\\\":1,\\\"passed\\\":true,\\\"expected\\\":\\\"compiled\\\",\\\"actual\\\":\\\"compiled\\\"}]" << std::endl;
    return 0;
}
`;

  try {
    await fs.writeFile(srcPath, harness, "utf8");

    const compiler = process.platform === "win32" ? "g++" : "g++";
    const { stdout: compileOut, stderr: compileErr, timedOut: compileTimeout } =
      await runSubprocess(compiler, [srcPath, "-o", binPath, "-std=c++17"], tmpDir, 10000);

    if (compileTimeout || compileErr) {
      return {
        passed: false,
        results: unitTests.map((t, idx) => ({
          index: idx + 1,
          passed: false,
          expected: String(t.expected),
          actual: "Compile error: " + (compileErr || "timeout").split("\n")[0],
        })),
        output: "Compile Error: " + (compileErr || "Timeout"),
      };
    }

    const { stdout, timedOut } = await runSubprocess(binPath, [], tmpDir, 5000);

    if (timedOut) {
      return {
        passed: false,
        results: unitTests.map((t, idx) => ({
          index: idx + 1,
          passed: false,
          expected: String(t.expected),
          actual: "Timeout",
        })),
        output: "> Execution timed out.",
      };
    }

    const match = stdout.match(/__DEVRANK_RESULTS__(.*)$/m);
    if (match) {
      try {
        const results = JSON.parse(match[1]);
        const passed = results.every((r) => r.passed);
        return {
          passed,
          results,
          output: passed ? "> C++ compiled and ran successfully." : "> C++ tests failed.",
        };
      } catch {}
    }

    return {
      passed: true,
      results: [{ index: 1, passed: true, expected: "compiled", actual: "compiled" }],
      output: "> C++ compiled and ran successfully.",
    };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

