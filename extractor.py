#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PAC Firmware Extractor - Versão Final (Foco Total em Python)
Extrai TODAS as partições + gaps + blobs de arquivos .pac Unisoc/Spreadtrum.
"""

import argparse
import os
import struct
import sys
import time

# ====================== CONSTANTES ======================
PAC_HEADER_FMT = '<44s I I 512s 512s I I I I I I I 200s I I I 800s I H H'
FILE_HEADER_FMT = '<I 512s 512s 504s I I I I I I I I 5I 996s'

PAC_HEADER_SIZE = struct.calcsize(PAC_HEADER_FMT)
FILE_HEADER_SIZE = struct.calcsize(FILE_HEADER_FMT)


def abort(msg):
    print(f"❌ ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def get_string(data):
    try:
        return data.decode('utf-16le').rstrip('\x00')
    except:
        return data.decode('latin-1', errors='ignore').rstrip('\x00')


def read_pac_header(f):
    f.seek(0)
    data = f.read(PAC_HEADER_SIZE)
    if len(data) < PAC_HEADER_SIZE:
        abort("Arquivo muito pequeno para ser um PAC válido.")

    unpacked = struct.unpack(PAC_HEADER_FMT, data)
    keys = ['szVersion', 'dwHiSize', 'dwLoSize', 'productName', 'firmwareName',
            'partitionCount', 'partitionsListStart', 'dwMode', 'dwFlashType',
            'dwNandStrategy', 'dwIsNvBackup', 'dwNandPageType', 'szPrdAlias',
            'dwOmaDmProductFlag', 'dwIsOmaDM', 'dwIsPreload', 'dwReserved',
            'dwMagic', 'wCRC1', 'wCRC2']

    header = {}
    for i, k in enumerate(keys):
        header[k] = get_string(unpacked[i]) if 'Name' in k or k.startswith('sz') else unpacked[i]
    return header


def read_file_header(f):
    data = f.read(FILE_HEADER_SIZE)
    if len(data) < FILE_HEADER_SIZE:
        return None
    unpacked = struct.unpack(FILE_HEADER_FMT, data)
    keys = ['length', 'partitionName', 'fileName', 'szFileName',
            'hiPartitionSize', 'hiDataOffset', 'loPartitionSize',
            'nFileFlag', 'nCheckFlag', 'loDataOffset',
            'dwCanOmitFlag', 'dwAddrNum', 'dwAddr', 'dwReserved']

    fh = {}
    for i, k in enumerate(keys):
        fh[k] = get_string(unpacked[i]) if 'Name' in k else unpacked[i]
    return fh


def extract_partition(f, fh, outdir, quiet=False):
    offset = (fh['hiDataOffset'] << 32) | fh['loDataOffset']
    size = (fh['hiPartitionSize'] << 32) | fh['loPartitionSize']

    name = fh['fileName'].strip() or fh['partitionName'].strip()
    if not name:
        name = f"partition_{fh.get('dwAddr', 0):08x}.bin"

    name = name.replace('/', '_').replace('\\', '_').replace(':', '_').replace('\x00', '')
    outpath = os.path.join(outdir, name)

    if size == 0:
        if not quiet:
            print(f"  [VAZIO] {name}")
        return

    if not quiet:
        print(f"  📤 Extraindo: {name} ({size:,} bytes) @ 0x{offset:X}...", end='', flush=True)

    f.seek(offset)
    with open(outpath, 'wb') as out:
        remaining = size
        while remaining > 0:
            chunk = f.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            out.write(chunk)
            remaining -= len(chunk)

    if not quiet:
        print(" ✅ OK")


def extract_all_blobs(f, outdir):
    """Varredura inteligente por assinaturas (melhorada)"""
    signatures = {
        b'\x1f\x8b\x08': '.gz',
        b'PK\x03\x04': '.zip',
        b'\x7fELF': '.elf',
        b'ANDROID!': '.img',
        b'AVB0': '.vbmeta',
        b'CHROMEOS': '.img',
        b'IMAGEWTY': '.img',
        b'LOGO': '.bmp',
        b'BM': '.bmp',
        b'<?xml': '.xml',
        b'<Scheme': '.xml',
        b'<BMAConfig': '.xml',
        b'PackInfo': '.bin',
    }

    f.seek(0, os.SEEK_END)
    total = f.tell()
    f.seek(0)

    pos = 0
    blobs_found = 0
    chunk_size = 2 * 1024 * 1024

    print("\n🔎 Procurando blobs por assinatura...")

    while pos < total:
        f.seek(pos)
        data = f.read(chunk_size)
        if not data:
            break

        for sig, ext in signatures.items():
            idx = data.find(sig)
            if idx != -1:
                start = pos + idx

                # Tenta descobrir onde termina o blob atual
                next_start = total
                for other_sig in signatures:
                    next_idx = data.find(other_sig, idx + len(sig))
                    if next_idx != -1:
                        next_start = min(next_start, pos + next_idx)

                size = min(next_start - start, 50 * 1024 * 1024)

                f.seek(start)
                blob = f.read(size)

                outname = f"blob_{blobs_found:04d}{ext}"
                outpath = os.path.join(outdir, outname)

                with open(outpath, 'wb') as bf:
                    bf.write(blob)

                print(f"  ✅ Blob encontrado: {outname} @ 0x{start:X} ({len(blob):,} bytes)")
                blobs_found += 1
                pos = start + len(blob)
                break
        else:
            pos += chunk_size - 512


def main():
    parser = argparse.ArgumentParser(description='PAC Extractor - Versão Final')
    parser.add_argument('pacfile', help='Arquivo .pac')
    parser.add_argument('outdir', nargs='?', default='extracted_pac', help='Pasta de saída')
    parser.add_argument('--dump-all', action='store_true', help='Extrai todas as áreas não usadas (RECOMENDADO)')
    parser.add_argument('--blobs', action='store_true', help='Extrai blobs por assinatura (RECOMENDADO)')
    parser.add_argument('-q', '--quiet', action='store_true', help='Modo silencioso')
    parser.add_argument('--debug', action='store_true', help='Mostra debug')

    args = parser.parse_args()

    if not os.path.isfile(args.pacfile):
        abort(f"Arquivo não encontrado: {args.pacfile}")

    os.makedirs(args.outdir, exist_ok=True)

    start_time = time.time()

    with open(args.pacfile, 'rb') as f:
        if not args.quiet:
            print("📦 Lendo cabeçalho PAC...")

        pac = read_pac_header(f)

        if args.debug:
            print("\n=== DEBUG - CABEÇALHO PAC ===")
            for k, v in pac.items():
                print(f"  {k}: {v}")

        if pac['dwMagic'] != 0xfffafffa:
            print("⚠️  Aviso: Magic number diferente (pode ser PAC novo)")

        # Ler partições
        part_count = pac['partitionCount']
        table_offset = pac['partitionsListStart']
        f.seek(table_offset)

        partitions = []
        for i in range(part_count):
            fh = read_file_header(f)
            if fh is None:
                break
            partitions.append(fh)

        if not args.quiet:
            print(f"✅ Encontradas {len(partitions)} partições.")

        # Extrair partições oficiais
        used_ranges = [(0, PAC_HEADER_SIZE)]
        table_end = table_offset + part_count * FILE_HEADER_SIZE
        used_ranges.append((table_offset, table_end))

        for fh in partitions:
            offset = (fh['hiDataOffset'] << 32) | fh['loDataOffset']
            size = (fh['hiPartitionSize'] << 32) | fh['loPartitionSize']
            if size > 0:
                used_ranges.append((offset, offset + size))
            extract_partition(f, fh, args.outdir, args.quiet)

        # Dump-all (tudo que sobrou)
        if args.dump_all:
            f.seek(0, os.SEEK_END)
            total_size = f.tell()
            used_ranges.sort()
            merged = []
            for s, e in used_ranges:
                if merged and s <= merged[-1][1]:
                    merged[-1] = (merged[-1][0], max(merged[-1][1], e))
                else:
                    merged.append((s, e))

            unused = []
            prev = 0
            for s, e in merged:
                if s > prev:
                    unused.append((prev, s))
                prev = max(prev, e)
            if prev < total_size:
                unused.append((prev, total_size))

            for idx, (start, end) in enumerate(unused):
                size = end - start
                if size > 0:
                    outpath = os.path.join(args.outdir, f'extra_data_{idx:04d}.bin')
                    f.seek(start)
                    with open(outpath, 'wb') as uf:
                        remaining = size
                        while remaining > 0:
                            chunk = f.read(min(1024*1024, remaining))
                            uf.write(chunk)
                            remaining -= len(chunk)
                    if not args.quiet:
                        print(f"📦 extra_data_{idx:04d}.bin ({size:,} bytes)")

        # Blobs
        if args.blobs:
            extract_all_blobs(f, args.outdir)

    elapsed = time.time() - start_time
    if not args.quiet:
        print(f"\n🎉 Extração finalizada em {elapsed:.1f} segundos!")
        print(f"   Arquivos salvos em: {os.path.abspath(args.outdir)}")


if __name__ == '__main__':
    main()