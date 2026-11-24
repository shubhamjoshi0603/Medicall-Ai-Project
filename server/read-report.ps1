param([Parameter(Mandatory=$true)][string]$DocumentPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$asyncMethods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 }
$operation = $asyncMethods | Where-Object { $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
$action = $asyncMethods | Where-Object { !$_.IsGenericMethod -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
function Resolve-Operation($value, [Type]$type) {
    $task = $operation.MakeGenericMethod($type).Invoke($null, @($value))
    $task.Wait()
    $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (!$engine) { throw 'OCR language unavailable' }
function Read-Page($stream) {
    $decoder = Resolve-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    if ($decoder.PixelWidth -gt 4096 -or $decoder.PixelHeight -gt 4096) { throw 'Image exceeds OCR dimensions' }
    $bitmap = Resolve-Operation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
        $result = Resolve-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        foreach ($line in $result.Lines) { $line.Text }
    } finally { $bitmap.Dispose() }
}
$file = Resolve-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($DocumentPath)) ([Windows.Storage.StorageFile])
if ([IO.Path]::GetExtension($DocumentPath) -eq '.pdf') {
    $document = Resolve-Operation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
    for ($i = 0; $i -lt [Math]::Min(10,$document.PageCount); $i++) {
        $page = $document.GetPage($i)
        $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
        try {
            $task = $action.Invoke($null, @($page.RenderToStreamAsync($stream)))
            $task.Wait()
            $stream.Seek(0)
            Read-Page $stream
        } finally { $stream.Dispose(); $page.Dispose() }
    }
} else {
    $stream = Resolve-Operation ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    try { Read-Page $stream } finally { $stream.Dispose() }
}
