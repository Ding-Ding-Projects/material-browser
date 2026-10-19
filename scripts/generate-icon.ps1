param([string]$OutputDirectory=(Join-Path (Split-Path $PSScriptRoot -Parent) 'apps/desktop/assets'))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
function New-RoundedPath([single]$x,[single]$y,[single]$w,[single]$h,[single]$r) {
 $p=New-Object Drawing.Drawing2D.GraphicsPath
 $d=$r*2
 $p.AddArc($x,$y,$d,$d,180,90);$p.AddArc($x+$w-$d,$y,$d,$d,270,90)
 $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90);$p.AddArc($x,$y+$h-$d,$d,$d,90,90);$p.CloseFigure()
 return ,$p
}
$bitmap=New-Object Drawing.Bitmap 256,256
$graphics=[Drawing.Graphics]::FromImage($bitmap)
$purple=New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#4f378b'))
$surface=New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#eaddff'))
$purplePen=New-Object Drawing.Pen $purple,10
$mintPen=New-Object Drawing.Pen ([Drawing.ColorTranslator]::FromHtml('#b5f4db')),7
try {
 $graphics.SmoothingMode='AntiAlias';$graphics.Clear([Drawing.Color]::Transparent)
 $tile=New-RoundedPath 8 8 240 240 64;$frame=New-RoundedPath 38 48 180 160 24
 try {$graphics.FillPath($purple,$tile);$graphics.FillPath($surface,$frame)} finally {$tile.Dispose();$frame.Dispose()}
 $graphics.DrawLine($purplePen,38,82,218,82)
 $graphics.FillEllipse($purple,54,60,10,10);$graphics.FillEllipse($purple,70,60,10,10)
 $graphics.FillEllipse($purple,82,96,92,92);$graphics.DrawEllipse($mintPen,106,96,44,92)
 $graphics.DrawLine($mintPen,84,142,172,142);$graphics.DrawLine($mintPen,91,120,165,120);$graphics.DrawLine($mintPen,91,164,165,164)
 $bitmap.Save((Join-Path $OutputDirectory 'material-browser.png'),[Drawing.Imaging.ImageFormat]::Png)
 $frames=@()
 foreach($size in @(16,24,32,48,64,128,256)) {
   $scaled=New-Object Drawing.Bitmap $size,$size
   $g=[Drawing.Graphics]::FromImage($scaled);$stream=New-Object IO.MemoryStream
   try {$g.InterpolationMode='HighQualityBicubic';$g.DrawImage($bitmap,0,0,$size,$size);$scaled.Save($stream,[Drawing.Imaging.ImageFormat]::Png);$frames+=,@{size=$size;bytes=$stream.ToArray()}}
   finally {$g.Dispose();$scaled.Dispose();$stream.Dispose()}
 }
 $file=[IO.File]::Create((Join-Path $OutputDirectory 'material-browser.ico'));$writer=New-Object IO.BinaryWriter $file
 try {
   $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
   $offset=6+16*$frames.Count
   foreach($frame in $frames){$dimension=if($frame.size -eq 256){0}else{$frame.size};$writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$frame.bytes.Length);$writer.Write([uint32]$offset);$offset+=$frame.bytes.Length}
   foreach($frame in $frames){$writer.Write([byte[]]$frame.bytes)}
 } finally {$writer.Dispose();$file.Dispose()}
} finally {$mintPen.Dispose();$purplePen.Dispose();$purple.Dispose();$surface.Dispose();$graphics.Dispose();$bitmap.Dispose()}
