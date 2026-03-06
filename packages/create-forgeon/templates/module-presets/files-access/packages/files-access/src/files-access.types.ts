export type FilesAccessAction = 'read' | 'delete';

export type FilesAccessVisibility = 'private' | 'owner' | 'group' | 'public' | string;

export type FilesAccessRecord = {
  ownerType: string;
  ownerId: string | null;
  visibility: FilesAccessVisibility;
};

export type FilesAccessSubject = {
  actorId: string | null;
  permissions: string[];
};
