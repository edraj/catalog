export function formatDate(dateString: string): string {
    const date = new Date(dateString);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${MM}`;
}

export function truncateString(str: string): string {
    return str && str.length > 100 ? str.slice(0, 100) + "..." : str;
}

export function renderStateString(idea: any){
    if (idea.is_active === false) {
        return "Inactive";
    }
    if(idea.state === "pending" ){
        return "Pending";
    }
    if(idea.state === "in_progress" ){
        return "In Progress";
    }
    if(idea.state === "approved" ){
        return "Approved";
    }
    if(idea.state === "rejected" ){
        return "Rejected";
    }
    return "N/A";
}

export function renderStateIcon(idea: any): string {
    if (idea.is_active === false) {
        return "bi bi-x-circle text-secondary";
    }
    if(idea.state === "pending" ){
        return "bi bi-hourglass text-primary";
    }
    if(idea.state === "in_progress" ){
        return "bi bi-arrow-repeat text-warning";
    }
    if(idea.state === "approved" ){
        return "bi bi-check-lg text-success";
    }
    if(idea.state === "rejected" ){
        return "bi bi-x-lg text-danger";
    }
    return "N/A";
}
