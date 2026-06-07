import { serveGeneratedFile } from "@/lib/generated-media";

export async function GET(_: Request, { params }: { params: { filename: string } }) {
  return serveGeneratedFile("videos", params.filename);
}
