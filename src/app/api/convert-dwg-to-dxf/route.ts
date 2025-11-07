import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, readFile, mkdir, copyFile, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// Kiểm tra xem có tool convert DWG không
async function checkConverterTool(): Promise<string | null> {
  try {
    // Thử LibreDWG (open source)
    await execAsync('odafileconverter --version');
    return 'odafileconverter';
  } catch {
    try {
      // Thử LibreDWG
      await execAsync('dwg2dxf --version');
      return 'dwg2dxf';
    } catch {
      // Thử ODA File Converter
      try {
        await execAsync('ODAFileConverter --version');
        return 'ODAFileConverter';
      } catch {
        return null;
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Kiểm tra tool convert
    const converterTool = await checkConverterTool();
    
    if (!converterTool) {
      return NextResponse.json(
        { 
          error: 'DWG converter tool not found. Please install LibreDWG or ODA File Converter on the server.',
          hint: 'Install LibreDWG: sudo apt-get install libredwg-tools (Linux) or brew install libredwg (macOS)'
        },
        { status: 500 }
      );
    }

    // Tạo file tạm
    const tempDir = tmpdir();
    const inputPath = join(tempDir, `input_${Date.now()}.dwg`);
    const outputPath = join(tempDir, `output_${Date.now()}.dxf`);

    try {
      // Lưu file upload vào temp
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(inputPath, buffer);

      // Convert DWG → DXF
      let command: string;
      
      if (converterTool === 'odafileconverter') {
        // ODA File Converter format: odafileconverter input_folder output_folder version
        const inputFolder = join(tempDir, `input_${Date.now()}`);
        const outputFolder = join(tempDir, `output_${Date.now()}`);
        
        // Tạo folders (cross-platform)
        if (!existsSync(inputFolder)) {
          await mkdir(inputFolder, { recursive: true });
        }
        if (!existsSync(outputFolder)) {
          await mkdir(outputFolder, { recursive: true });
        }
        
        // Copy file vào input folder (cross-platform)
        const inputFilePath = join(inputFolder, file.name);
        await copyFile(inputPath, inputFilePath);
        
        command = `odafileconverter "${inputFolder}" "${outputFolder}" ACAD2018`;
        await execAsync(command);
        
        // Tìm file DXF đã convert (cross-platform)
        const files = await readdir(outputFolder, { recursive: true });
        const dxfFile = files.find(f => f.toLowerCase().endsWith('.dxf'));
        
        if (dxfFile) {
          const dxfPath = join(outputFolder, dxfFile);
          const dxfContent = await readFile(dxfPath);
          
          // Cleanup folders
          try {
            await unlink(inputFilePath);
            await unlink(dxfPath);
          } catch {}
          
          return new NextResponse(dxfContent, {
            headers: {
              'Content-Type': 'application/dxf',
              'Content-Disposition': `attachment; filename="${file.name.replace(/\.dwg$/i, '.dxf')}"`,
            },
          });
        }
      } else if (converterTool === 'dwg2dxf') {
        command = `dwg2dxf "${inputPath}" "${outputPath}"`;
        await execAsync(command);
        const dxfContent = await readFile(outputPath);
        return new NextResponse(dxfContent, {
          headers: {
            'Content-Type': 'application/dxf',
            'Content-Disposition': `attachment; filename="${file.name.replace(/\.dwg$/i, '.dxf')}"`,
          },
        });
      } else {
        throw new Error(`Unsupported converter tool: ${converterTool}`);
      }

      return NextResponse.json(
        { error: 'Conversion failed - no output file generated' },
        { status: 500 }
      );
    } finally {
      // Cleanup temp files
      try {
        await unlink(inputPath);
      } catch {}
      try {
        await unlink(outputPath);
      } catch {}
    }
  } catch (error: any) {
    console.error('DWG conversion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to convert DWG to DXF',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

