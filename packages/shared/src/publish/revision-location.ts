/** Location anchor shared by revision items and editorial findings. */
export interface RevisionLocation {
  readonly sectionId?: string;
  readonly headingText?: string;
  readonly excerpt?: string;
  readonly lineRange?: { readonly start: number; readonly end: number };
}
