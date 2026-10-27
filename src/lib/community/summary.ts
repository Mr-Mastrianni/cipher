/** Wire shapes shared by the world's community summary and its client. */

export interface CommunityLatest {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface CommunityChannelSummary {
  slug: string;
  name: string;
  description: string | null;
  tierRequired: string | null;
  latest: CommunityLatest | null;
  href: string;
}

export interface CommunityDmSummary {
  id: string;
  otherName: string;
  latest: CommunityLatest | null;
  href: string;
}

export interface CommunitySummary {
  channels: CommunityChannelSummary[];
  dms: CommunityDmSummary[];
  fetchedAt: string;
}
