type AccessLevel = {
    id: number;
    levelName: string;
    description: string;
};

export type User = {
    id: number;
    hca34id: string;
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    accessLevelId: number;
    defaultFacilityId?: number | null;
    lastLogin: string;
    isDarkMode: boolean;
    dateCreated: string;
    createdBy: string;
    accessLevel?: AccessLevel | null;
    facility?: string | null;
};