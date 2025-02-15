interface Translation {
    ar: string;
    en: string;
    ku: string;
}

interface User {
    shortname: string;
    displayname: Translation;
    description: Translation;
    password: string;
}

interface ProjectIdea {
    title: string;
    budget: string;
    long_description: string;
    short_description: string;
    shortname?: string;
    state?: string;
    created_at?: string;
    updated_at?: string;
}