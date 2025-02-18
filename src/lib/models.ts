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
    title: string
    tags: string[]
    content: string
    is_active: boolean
}