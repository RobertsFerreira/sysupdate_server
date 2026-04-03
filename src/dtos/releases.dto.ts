import { z } from "zod";

const InsertReleaseFileDTOSchema = z.object({
  target: z.string(),
  checksum: z.string(),
})
export type InsertReleaseFile = z.infer<typeof InsertReleaseFileDTOSchema>
export type InsertReleaseFiles = InsertReleaseFile[];

const InsertReleaseDTOSchema = z.object({
  version: z.string(),
  description: z.string().max(200).nullable().default(null),
  min_version: z.string().nullable().default(null),
  bundle_file: z.string(),
  bundle_checksum: z.string(),
  release_date: z.iso.datetime(),
  published_by: z.string(),
  files: z.array(InsertReleaseFileDTOSchema)
});
export type InsertReleaseDTO = z.infer<typeof InsertReleaseDTOSchema>

const ReleaseFileDTOSchema = z.object({
  id: z.number(),
  target: z.string(),
  checksum: z.string(),
})
export type ReleaseFileDTO = z.infer<typeof ReleaseFileDTOSchema>

export const ReleaseHeaderDTOSchema = z.object({
  id: z.number(),
  version: z.string(),
  description: z.string().nullable().default(''),
  min_version: z.string().nullable().default(''),
  bundle_file: z.string(),
  bundle_checksum: z.string(),
  release_date: z.iso.datetime(),
  published_by: z.string(),
});
export type ReleaseHeaderDTO = z.infer<typeof ReleaseHeaderDTOSchema>

const ReleaseResponseDTOSchema = z.object({
  ...ReleaseHeaderDTOSchema.shape,
  files: z.array(ReleaseFileDTOSchema),
});

export type ReleaseResponseDTO = z.infer<typeof ReleaseResponseDTOSchema>
export type ReleasesResponseDTO = ReleaseResponseDTO[];
export function toReleaseDTO(data: Record<string, unknown>) {
  return ReleaseResponseDTOSchema.parse(data);
}



