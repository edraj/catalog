/**
 * Downloads a file to the user's computer
 * @param data - The file content
 * @param fileName - The name of the file to download
 * @param fileType - The MIME type of the file
 */
export function downloadFile(data: any, fileName: string, fileType: string) {
  const blob = new Blob([data], { type: fileType });
  const a = document.createElement("a");
  a.download = fileName;
  a.href = window.URL.createObjectURL(blob);
  const clickEvt = new MouseEvent("click", {
    view: window,
    bubbles: true,
    cancelable: true,
  });
  a.dispatchEvent(clickEvt);
  a.remove();
}

export default downloadFile;
