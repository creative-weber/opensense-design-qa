export {
  getFile,
  getFrameImage,
  FigmaClientError,
  FigmaRateLimitError,
} from "./client.js";

export type {
  FigmaFileResponse,
  FigmaNode,
  FigmaFrameImageResult,
} from "./client.js";

export {
  parseFigmaFrameReference,
  isParseError,
} from "./parser.js";

export type {
  FigmaFrameReference,
  ParseError,
} from "./parser.js";

export { normalizeFigmaNodeTree } from "./normalizer.js";

export type {
  FigmaSnapshot,
  FigmaRawNode,
  FigmaNodesApiResponse,
} from "./normalizer.js";
