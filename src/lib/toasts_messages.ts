import {toast} from "@zerodevx/svelte-toast";

/**
 * Displays a success toast message with green styling
 * @param message - The success message to display
 */
export function successToastMessage(message: string){
    toast.push(message, {
        theme: {
            '--toastColor': 'mintcream',
            '--toastBarBackground': 'rgba(72,187,120)',
            '--toastBackground': 'rgb(0,150,0)'
        }
    })
}

/**
 * Displays an error toast message with red styling
 * @param message - The error message to display
 * @param noClose - If true, the toast will not auto-close (default: false)
 */
export function errorToastMessage(message: string, noClose: boolean = false){
    const option: any = {
        theme: {
            '--toastColor': 'mintcream',
            '--toastBarBackground': 'rgba(187,72,72)',
            '--toastBackground': 'rgb(150,0,0)'
        }
    }
    if (noClose){
        option.initial = 0
    }
    toast.push(message, option)
}