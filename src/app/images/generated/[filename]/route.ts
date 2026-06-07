import { serveGeneratedFile } from "@/lib/generated-media";

export async function GET(_: Request, { params }: { params: { filename: string } }) {
  return serveGeneratedFile("images", params.filename);
}
