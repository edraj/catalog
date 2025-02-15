import {toast} from "@zerodevx/svelte-toast";

export function successToastMessage(message: string){
    toast.push(message, {
        theme: {
            '--toastColor': 'mintcream',
            '--toastBackground': 'rgba(72,187,120)',
            '--toastBarBackground': 'rgb(0,255,0)'
        }
    })
}

export function errorToastMessage(message: string, noClose: boolean = false){
    const option: any = {
        theme: {
            '--toastColor': 'mintcream',
            '--toastBackground': 'rgba(187,72,72)',
            '--toastBarBackground': 'rgb(255,0,0)'
        }
    }
    if (noClose){
        option.initial = 0
    }
    toast.push(message, option)
}