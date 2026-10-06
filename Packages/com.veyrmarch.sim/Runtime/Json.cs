#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Veyr.Sim
{
    public enum JsonKind
    {
        Null,
        Bool,
        Number,
        String,
        Array,
        Object
    }

    /// <summary>
    /// Small JSON tree for save documents. Unity does not ship System.Text.Json, and reflection
    /// serializers fight IL2CPP stripping, so documents are written field by field.
    /// Numbers keep their source text so a ulong seed survives a round trip exactly.
    /// </summary>
    public sealed class JsonNode
    {
        const int MaxDepth = 64;

        readonly string _text;
        readonly bool _bool;
        readonly List<JsonNode>? _items;
        readonly Dictionary<string, JsonNode>? _fields;

        JsonNode(JsonKind kind, string text = "", bool value = false, List<JsonNode>? items = null, Dictionary<string, JsonNode>? fields = null)
        {
            Kind = kind;
            _text = text;
            _bool = value;
            _items = items;
            _fields = fields;
        }

        public JsonKind Kind { get; }

        public IReadOnlyList<JsonNode> Items =>
            _items ?? throw new FormatException("Expected a JSON array.");

        public IReadOnlyDictionary<string, JsonNode> Fields =>
            _fields ?? throw new FormatException("Expected a JSON object.");

        public JsonNode this[string key]
        {
            get
            {
                if (_fields == null)
                    throw new FormatException("Expected a JSON object.");
                if (!_fields.TryGetValue(key, out var node))
                    throw new FormatException("Missing field " + key + ".");
                return node;
            }
        }

        public bool Has(string key) => _fields != null && _fields.ContainsKey(key);

        public string AsString() =>
            Kind == JsonKind.String ? _text : throw new FormatException("Expected a string.");

        public bool AsBool() =>
            Kind == JsonKind.Bool ? _bool : throw new FormatException("Expected a bool.");

        public long AsLong() => long.Parse(NumberText(), NumberStyles.Integer, CultureInfo.InvariantCulture);

        public ulong AsULong() => ulong.Parse(NumberText(), NumberStyles.Integer, CultureInfo.InvariantCulture);

        public int AsInt() => int.Parse(NumberText(), NumberStyles.Integer, CultureInfo.InvariantCulture);

        public double AsDouble() => double.Parse(NumberText(), NumberStyles.Float, CultureInfo.InvariantCulture);

        public float AsFloat() => (float)AsDouble();

        public string Str(string key, string fallback = "") =>
            Has(key) && this[key].Kind == JsonKind.String ? this[key].AsString() : fallback;

        public int Int(string key, int fallback = 0) =>
            Has(key) && this[key].Kind == JsonKind.Number ? this[key].AsInt() : fallback;

        public long Long(string key, long fallback = 0) =>
            Has(key) && this[key].Kind == JsonKind.Number ? this[key].AsLong() : fallback;

        public float Float(string key, float fallback = 0f) =>
            Has(key) && this[key].Kind == JsonKind.Number ? this[key].AsFloat() : fallback;

        public bool Bool(string key, bool fallback = false) =>
            Has(key) && this[key].Kind == JsonKind.Bool ? this[key].AsBool() : fallback;

        string NumberText() =>
            Kind == JsonKind.Number ? _text : throw new FormatException("Expected a number.");

        public static JsonNode Parse(string text)
        {
            if (text == null)
                throw new ArgumentNullException(nameof(text));
            int at = 0;
            var node = ParseValue(text, ref at, 0);
            SkipSpace(text, ref at);
            if (at != text.Length)
                throw new FormatException("Trailing characters after JSON at " + at + ".");
            return node;
        }

        static JsonNode ParseValue(string s, ref int at, int depth)
        {
            if (depth > MaxDepth)
                throw new FormatException("JSON nests too deep.");
            SkipSpace(s, ref at);
            if (at >= s.Length)
                throw new FormatException("Unexpected end of JSON.");
            char c = s[at];
            switch (c)
            {
                case '{':
                    return ParseObject(s, ref at, depth);
                case '[':
                    return ParseArray(s, ref at, depth);
                case '"':
                    return new JsonNode(JsonKind.String, ParseString(s, ref at));
                case 't':
                    Expect(s, ref at, "true");
                    return new JsonNode(JsonKind.Bool, value: true);
                case 'f':
                    Expect(s, ref at, "false");
                    return new JsonNode(JsonKind.Bool, value: false);
                case 'n':
                    Expect(s, ref at, "null");
                    return new JsonNode(JsonKind.Null);
                default:
                    if (c == '-' || (c >= '0' && c <= '9'))
                        return new JsonNode(JsonKind.Number, ParseNumber(s, ref at));
                    throw new FormatException("Unexpected character '" + c + "' at " + at + ".");
            }
        }

        static JsonNode ParseObject(string s, ref int at, int depth)
        {
            var fields = new Dictionary<string, JsonNode>(StringComparer.Ordinal);
            at++;
            SkipSpace(s, ref at);
            if (at < s.Length && s[at] == '}')
            {
                at++;
                return new JsonNode(JsonKind.Object, fields: fields);
            }

            while (true)
            {
                SkipSpace(s, ref at);
                if (at >= s.Length || s[at] != '"')
                    throw new FormatException("Expected a field name at " + at + ".");
                string key = ParseString(s, ref at);
                SkipSpace(s, ref at);
                if (at >= s.Length || s[at] != ':')
                    throw new FormatException("Expected ':' at " + at + ".");
                at++;
                if (fields.ContainsKey(key))
                    throw new FormatException("Duplicate field " + key + ".");
                fields[key] = ParseValue(s, ref at, depth + 1);
                SkipSpace(s, ref at);
                if (at >= s.Length)
                    throw new FormatException("Unexpected end of object.");
                if (s[at] == ',')
                {
                    at++;
                    continue;
                }
                if (s[at] == '}')
                {
                    at++;
                    return new JsonNode(JsonKind.Object, fields: fields);
                }
                throw new FormatException("Expected ',' or '}' at " + at + ".");
            }
        }

        static JsonNode ParseArray(string s, ref int at, int depth)
        {
            var items = new List<JsonNode>();
            at++;
            SkipSpace(s, ref at);
            if (at < s.Length && s[at] == ']')
            {
                at++;
                return new JsonNode(JsonKind.Array, items: items);
            }

            while (true)
            {
                items.Add(ParseValue(s, ref at, depth + 1));
                SkipSpace(s, ref at);
                if (at >= s.Length)
                    throw new FormatException("Unexpected end of array.");
                if (s[at] == ',')
                {
                    at++;
                    continue;
                }
                if (s[at] == ']')
                {
                    at++;
                    return new JsonNode(JsonKind.Array, items: items);
                }
                throw new FormatException("Expected ',' or ']' at " + at + ".");
            }
        }

        static string ParseString(string s, ref int at)
        {
            var sb = new StringBuilder();
            at++;
            while (at < s.Length)
            {
                char c = s[at++];
                if (c == '"')
                    return sb.ToString();
                if (c < 0x20)
                    throw new FormatException("Control character in string.");
                if (c != '\\')
                {
                    sb.Append(c);
                    continue;
                }
                if (at >= s.Length)
                    break;
                char e = s[at++];
                switch (e)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (at + 4 > s.Length)
                            throw new FormatException("Short unicode escape.");
                        sb.Append((char)int.Parse(s.Substring(at, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        at += 4;
                        break;
                    default:
                        throw new FormatException("Bad escape \\" + e + ".");
                }
            }
            throw new FormatException("Unterminated string.");
        }

        static string ParseNumber(string s, ref int at)
        {
            int start = at;
            if (s[at] == '-')
                at++;
            while (at < s.Length && (char.IsDigit(s[at]) || s[at] == '.' || s[at] == 'e' || s[at] == 'E' || s[at] == '+' || s[at] == '-'))
                at++;
            string text = s.Substring(start, at - start);
            if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out _))
                throw new FormatException("Bad number " + text + ".");
            return text;
        }

        static void Expect(string s, ref int at, string word)
        {
            if (string.CompareOrdinal(s, at, word, 0, word.Length) != 0)
                throw new FormatException("Expected " + word + " at " + at + ".");
            at += word.Length;
        }

        static void SkipSpace(string s, ref int at)
        {
            while (at < s.Length && (s[at] == ' ' || s[at] == '\t' || s[at] == '\n' || s[at] == '\r'))
                at++;
        }
    }

    /// <summary>Forward-only JSON writer. Commas are tracked per open container.</summary>
    public sealed class JsonWriter
    {
        readonly StringBuilder _sb = new StringBuilder();
        readonly Stack<bool> _first = new Stack<bool>();
        bool _afterKey;

        public JsonWriter BeginObject()
        {
            Separator();
            _sb.Append('{');
            _first.Push(true);
            return this;
        }

        public JsonWriter EndObject()
        {
            _first.Pop();
            _sb.Append('}');
            return this;
        }

        public JsonWriter BeginArray()
        {
            Separator();
            _sb.Append('[');
            _first.Push(true);
            return this;
        }

        public JsonWriter EndArray()
        {
            _first.Pop();
            _sb.Append(']');
            return this;
        }

        public JsonWriter Key(string name)
        {
            Separator();
            AppendString(name);
            _sb.Append(':');
            _afterKey = true;
            return this;
        }

        public JsonWriter Value(string value)
        {
            Separator();
            AppendString(value ?? "");
            return this;
        }

        public JsonWriter Value(bool value)
        {
            Separator();
            _sb.Append(value ? "true" : "false");
            return this;
        }

        public JsonWriter Value(long value)
        {
            Separator();
            _sb.Append(value.ToString(CultureInfo.InvariantCulture));
            return this;
        }

        public JsonWriter Value(ulong value)
        {
            Separator();
            _sb.Append(value.ToString(CultureInfo.InvariantCulture));
            return this;
        }

        public JsonWriter Value(double value)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
                throw new ArgumentOutOfRangeException(nameof(value), "JSON cannot hold a non-finite number.");
            Separator();
            _sb.Append(value.ToString("R", CultureInfo.InvariantCulture));
            return this;
        }

        public JsonWriter Field(string key, string value) => Key(key).Value(value);
        public JsonWriter Field(string key, bool value) => Key(key).Value(value);
        public JsonWriter Field(string key, long value) => Key(key).Value(value);
        public JsonWriter Field(string key, ulong value) => Key(key).Value(value);
        public JsonWriter Field(string key, double value) => Key(key).Value(value);

        public override string ToString() => _sb.ToString();

        void Separator()
        {
            if (_afterKey)
            {
                _afterKey = false;
                return;
            }
            if (_first.Count == 0)
                return;
            if (_first.Peek())
            {
                _first.Pop();
                _first.Push(false);
                return;
            }
            _sb.Append(',');
        }

        void AppendString(string value)
        {
            _sb.Append('"');
            foreach (char c in value)
            {
                switch (c)
                {
                    case '"': _sb.Append("\\\""); break;
                    case '\\': _sb.Append("\\\\"); break;
                    case '\n': _sb.Append("\\n"); break;
                    case '\r': _sb.Append("\\r"); break;
                    case '\t': _sb.Append("\\t"); break;
                    case '\b': _sb.Append("\\b"); break;
                    case '\f': _sb.Append("\\f"); break;
                    default:
                        if (c < 0x20)
                            _sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else
                            _sb.Append(c);
                        break;
                }
            }
            _sb.Append('"');
        }
    }

    public static class Hex
    {
        static readonly char[] Digits = "0123456789ABCDEF".ToCharArray();

        public static string Upper(byte[] bytes)
        {
            var chars = new char[bytes.Length * 2];
            for (int i = 0; i < bytes.Length; i++)
            {
                chars[i * 2] = Digits[bytes[i] >> 4];
                chars[i * 2 + 1] = Digits[bytes[i] & 0xF];
            }
            return new string(chars);
        }

        public static string Sha256(string text)
        {
            using (var sha = System.Security.Cryptography.SHA256.Create())
                return Upper(sha.ComputeHash(Encoding.UTF8.GetBytes(text)));
        }
    }
}
