import packageMetadata from "../../../../package.json";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: packageMetadata.name,
      version: packageMetadata.version,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
