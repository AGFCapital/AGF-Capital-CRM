import assert from "node:assert/strict";
import { decodeApolloCsv, prepareApolloImport } from "../apollo-import.js";

const mojibakeReport = prepareApolloImport([
  "First Name;Last Name;Title;Company Name;Person Linkedin Url",
  "JoÃ£o;GonÃ§alves;CFO;M.A. MÃ¡quinas AgrÃ­colas;https://www.linkedin.com/in/joao-goncalves",
].join("\n"), "apollo-mojibake.csv");

assert.equal(mojibakeReport.records[0].fullName, "João Gonçalves",
  "Nomes pessoais com mojibake devem ser reparados antes do armazenamento.");
assert.equal(mojibakeReport.records[0].companyName, "M.A. Máquinas Agrícolas",
  "Nomes de empresas com mojibake devem ser reparados antes do armazenamento.");

const decomposedAccent = "Jose\u0301";
const unicodeReport = prepareApolloImport([
  "First Name;Last Name;Title;Company Name;Person Linkedin Url",
  `${decomposedAccent};Silva;CFO;Grupo São José;https://www.linkedin.com/in/jose-silva`,
].join("\n"), "apollo-unicode.csv");

assert.equal(unicodeReport.records[0].fullName, "José Silva",
  "Acentos Unicode decompostos devem ser convertidos para a forma canônica NFC.");

const windows1252Bytes = Uint8Array.from([
  ..."First Name;Last Name;Title;Company Name;Person Linkedin Url\nJo".split("").map((char) => char.charCodeAt(0)),
  0xe3,
  ..."o;Gon".split("").map((char) => char.charCodeAt(0)),
  0xe7,
  ..."alves;CFO;Máquinas".split("").flatMap((char) => {
    if (char === "á") return [0xe1];
    return [char.charCodeAt(0)];
  }),
  ...";https://www.linkedin.com/in/joao-goncalves".split("").map((char) => char.charCodeAt(0)),
]);
const windows1252Report = prepareApolloImport(
  decodeApolloCsv(windows1252Bytes),
  "apollo-windows-1252.csv",
);

assert.equal(windows1252Report.records[0].fullName, "João Gonçalves",
  "Arquivos Windows-1252 devem ser decodificados antes do parsing do CSV.");

console.log("csv encoding normalization: ok");
