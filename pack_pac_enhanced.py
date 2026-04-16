#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Empacotador PAC Universal - VERSÃO FINAL CORRIGIDA
Inclui automaticamente o XML como BMAConfig
"""

import os
import sys
import struct
import json
import argparse
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# ====================== CONSTANTES ======================
PAC_HEADER_FMT = '44s I I 512s 512s I I I I I I I 200s I I I 800s I H H'
FILE_HEADER_FMT = 'I 512s 512s 504s I I I I I I I I 5I 996s'

PAC_HEADER_SIZE = struct.calcsize(PAC_HEADER_FMT)
FILE_HEADER_SIZE = struct.calcsize(FILE_HEADER_FMT)

# Tabela CRC16 (completa)
CRC16_TABLE = [
    0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
    0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
    0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
    0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
    0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
    0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
    0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
    0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
    0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
    0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
    0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
    0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
    0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
    0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
    0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
    0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
    0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
    0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
    0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
    0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
    0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
    0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
    0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
    0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
    0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
    0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
    0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
    0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
    0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
    0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
    0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
    0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040,
]

def crc16(data: bytes, crc: int = 0) -> int:
    for byte in data:
        crc = (crc >> 8) ^ CRC16_TABLE[(crc ^ byte) & 0xFF]
    return crc & 0xFFFF

def get_utf16le_bytes(s: str, size: int) -> bytes:
    if not s:
        return b'\x00' * size
    encoded = s.encode('utf-16le')
    if len(encoded) > size:
        encoded = encoded[:size]
    return encoded.ljust(size, b'\x00')

def parse_scheme_from_xml(xml_path: str) -> List[Dict]:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    scheme_list = root.find('SchemeList')
    if scheme_list is None:
        raise ValueError("Tag <SchemeList> não encontrada no XML")
    schemes = scheme_list.findall('Scheme')
    if not schemes:
        raise ValueError("Nenhum <Scheme> encontrado")
    scheme = schemes[0]
    partitions = []
    for file_elem in scheme.findall('File'):
        id_elem = file_elem.find('ID')
        if id_elem is None or not id_elem.text:
            continue
        part_id = id_elem.text.strip()
        flag = int(file_elem.find('Flag').text or "0")
        check_flag = int(file_elem.find('CheckFlag').text or "0")
        base_addr = 0
        block = file_elem.find('Block')
        if block is not None:
            base_elem = block.find('Base')
            if base_elem is not None and base_elem.text:
                try:
                    base_addr = int(base_elem.text, 16)
                except ValueError:
                    pass
        partitions.append({
            'id': part_id,
            'base_addr': base_addr,
            'flag': flag,
            'check_flag': check_flag,
        })
    return partitions

def load_mapping(mapping_file: Optional[str] = None) -> Dict[str, str]:
    if mapping_file and os.path.isfile(mapping_file):
        with open(mapping_file, 'r', encoding='utf-8') as f:
            if mapping_file.endswith('.json'):
                return json.load(f)
            else:
                mapping = {}
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, val = line.split('=', 1)
                        mapping[key.strip()] = val.strip()
                return mapping
    # Mapeamento padrão
    return {
        "FDL": "fdl1-sign.bin", "FDL2": "fdl2-sign.bin",
        "NV_LTE": "sharkl5pro_pubcp_customer_nvitem.bin",
        "ProdNV": "prodnv.img", "VBMETA": "vbmeta-sign.img",
        "BOOT": "boot.img", "DTBO": "dtbo.img",
        "Super": "super.img", "Cache": "cache.img",
        "UserData": "userdata.img",
    }

def find_file_smart(part_id: str, available_files: Dict[str, str], mapping: Dict[str, str]) -> Tuple[Optional[str], Optional[str]]:
    expected = mapping.get(part_id, "")
    if expected and expected in available_files:
        return available_files[expected], expected
    part_lower = part_id.lower()
    for fname, fpath in available_files.items():
        if fname.lower() == part_lower or os.path.splitext(fname)[0].lower() == part_lower:
            return fpath, fname
    candidates = [(fname, fpath) for fname, fpath in available_files.items() if part_lower in fname.lower()]
    if candidates:
        candidates.sort(key=lambda x: len(x[0]))
        return candidates[0][1], candidates[0][0]
    return None, None

def human_readable_size(size: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

def pack_pac(input_dir: str, output_pac: str, product_name: str = "p352",
             mapping_file: Optional[str] = None, verify: bool = False, quiet: bool = False):
    
    if not quiet:
        print(f"\n📦 Empacotando PAC (XML será incluído automaticamente como BMAConfig)")

    # 1. Localizar XML
    xml_files = [f for f in os.listdir(input_dir) if f.lower().endswith('.xml')]
    if not xml_files:
        raise FileNotFoundError("Nenhum arquivo XML encontrado na pasta!")
    
    xml_path = os.path.join(input_dir, xml_files[0])
    xml_filename = xml_files[0]

    if not quiet:
        print(f"📄 XML encontrado: {xml_filename} → será incluído como BMAConfig")

    # 2. Carregar mapeamento e partições do XML
    mapping = load_mapping(mapping_file)
    partitions = parse_scheme_from_xml(xml_path)

    # 3. Arquivos disponíveis (exceto o XML)
    available_files = {
        f: os.path.join(input_dir, f)
        for f in os.listdir(input_dir)
        if os.path.isfile(os.path.join(input_dir, f)) and f != xml_filename
    }

    # 4. Lista final de arquivos a empacotar
    file_meta = []

    # === INCLUSÃO AUTOMÁTICA DO XML ===
    xml_size = os.path.getsize(xml_path)
    file_meta.append({
        'id': 'BMAConfig',
        'filepath': xml_path,
        'filename': xml_filename,
        'size': xml_size,
        'base_addr': 0,
        'flag': 0,
        'check_flag': 0,
    })
    if not quiet:
        print(f"   ✅ BMAConfig incluído ({human_readable_size(xml_size)})")

    # Partições normais do XML
    missing_mandatory = []
    for part in partitions:
        pid = part['id']
        filepath, filename = find_file_smart(pid, available_files, mapping)
        size = os.path.getsize(filepath) if filepath else 0

        if not filepath and part['check_flag'] != 0:
            missing_mandatory.append(pid)

        file_meta.append({
            'id': pid,
            'filepath': filepath,
            'filename': filename or '',
            'size': size,
            'base_addr': part['base_addr'],
            'flag': part['flag'],
            'check_flag': part['check_flag'],
        })

    if missing_mandatory and not quiet:
        print(f"⚠️  {len(missing_mandatory)} partições obrigatórias não encontradas!")

    # 5. Calcular offsets
    table_offset = PAC_HEADER_SIZE
    data_offset = table_offset + len(file_meta) * FILE_HEADER_SIZE
    curr = data_offset
    for fm in file_meta:
        fm['data_offset'] = curr
        fm['hi_data_offset'] = (curr >> 32) & 0xFFFFFFFF
        fm['lo_data_offset'] = curr & 0xFFFFFFFF
        fm['hi_size'] = (fm['size'] >> 32) & 0xFFFFFFFF
        fm['lo_size'] = fm['size'] & 0xFFFFFFFF
        curr += fm['size']

    total_size = curr
    hi_total = (total_size >> 32) & 0xFFFFFFFF
    lo_total = total_size & 0xFFFFFFFF

    if not quiet:
        print(f"📊 Tamanho total do PAC: {human_readable_size(total_size)}")

    # 6. Cabeçalho (CRC temporário)
    header = struct.pack(
        PAC_HEADER_FMT,
        get_utf16le_bytes("BP_R2.0.1", 44),
        hi_total, lo_total,
        get_utf16le_bytes(product_name, 512),
        get_utf16le_bytes("", 512),
        len(file_meta), table_offset,
        0, 0, 0, 1, 0,
        get_utf16le_bytes(product_name, 200),
        0, 1, 1,
        b'\x00' * 800,
        0xfffafffa,
        0, 0
    )

    # 7. Tabela de partições
    table = b''
    for fm in file_meta:
        addrs = [fm.get('base_addr', 0), 0, 0, 0, 0]
        addr_num = 1 if addrs[0] != 0 else 0
        entry = struct.pack(
            FILE_HEADER_FMT,
            FILE_HEADER_SIZE,
            get_utf16le_bytes(fm['id'], 512),
            get_utf16le_bytes(fm['filename'], 512),
            b'\x00' * 504,
            fm['hi_size'], fm['hi_data_offset'], fm['lo_size'],
            fm['flag'], fm['check_flag'], fm['lo_data_offset'],
            0, addr_num, *addrs, b'\x00' * 996
        )
        table += entry

    # 8. Escrever PAC + calcular CRC2
    if not quiet:
        print("✍️  Escrevendo PAC...")
    crc2 = 0
    bytes_written = 0
    total_data = sum(fm['size'] for fm in file_meta)

    with open(output_pac, 'wb') as outf:
        outf.write(header)
        outf.write(table)
        for fm in file_meta:
            if fm['size'] == 0:
                continue
            with open(fm['filepath'], 'rb') as inf:
                while chunk := inf.read(1024 * 1024):
                    outf.write(chunk)
                    crc2 = crc16(chunk, crc2)
                    bytes_written += len(chunk)
                    if not quiet and total_data > 0:
                        percent = int((bytes_written * 100) / total_data)
                        if percent % 10 == 0:
                            print(f"\r   Progresso: {percent}%", end='', flush=True)

    # 9. Calcular CRC1 e atualizar cabeçalho
    with open(output_pac, 'rb') as f:
        crc1 = crc16(f.read(PAC_HEADER_SIZE - 4))

    final_header = struct.pack(
        PAC_HEADER_FMT,
        get_utf16le_bytes("BP_R2.0.1", 44),
        hi_total, lo_total,
        get_utf16le_bytes(product_name, 512),
        get_utf16le_bytes("", 512),
        len(file_meta), table_offset,
        0, 0, 0, 1, 0,
        get_utf16le_bytes(product_name, 200),
        0, 1, 1,
        b'\x00' * 800,
        0xfffafffa,
        crc1, crc2
    )

    with open(output_pac, 'r+b') as f:
        f.seek(0)
        f.write(final_header)

    if not quiet:
        print(f"\n\n✅ PAC criado com sucesso!")
        print(f"   Arquivo: {output_pac}")
        print(f"   XML incluído como BMAConfig")
        print(f"   CRC1: 0x{crc1:04X} | CRC2: 0x{crc2:04X}")

def main():
    parser = argparse.ArgumentParser(description="Empacotador PAC - XML incluído automaticamente")
    parser.add_argument("input_dir", help="Pasta com os arquivos extraídos + XML")
    parser.add_argument("-o", "--output", help="Nome do arquivo PAC de saída")
    parser.add_argument("-p", "--product", default="p352", help="Nome do produto")
    parser.add_argument("--map", dest="map_file", help="Arquivo de mapeamento personalizado")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("-q", "--quiet", action="store_true")
    args = parser.parse_args()

    if not args.output:
        base = os.path.basename(args.input_dir.rstrip('/\\'))
        args.output = f"{base}_REPACKED_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pac"

    try:
        pack_pac(args.input_dir, args.output, args.product, args.map_file, args.verify, args.quiet)
    except Exception as e:
        print(f"\n❌ ERRO: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()