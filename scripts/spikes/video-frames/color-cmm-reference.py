"""Opt-in independent ICC transforms through an installed LittleCMS library.

Raw input/output sRGB: RGB24 bytes. Raw XYZ output: packed little-endian float64 XYZ.
For --samples-rgb, input is JSON integer RGB triples and output is JSON triples.
No paths or source-specific results are printed. Callers own result locations.
"""
import argparse
import ctypes
import ctypes.util
import json
import struct
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-icc", required=True)
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--input-rgb")
    inputs.add_argument("--samples-rgb")
    parser.add_argument("--target", choices=["srgb", "xyz"], required=True)
    parser.add_argument("--intent", choices=["relative", "perceptual", "absolute"], default="relative")
    parser.add_argument("--output", required=True)
    arguments = parser.parse_args()
    library = ctypes.util.find_library("lcms2")
    if not library:
        raise RuntimeError("Installed LittleCMS library unavailable")
    cms = ctypes.CDLL(library)
    cms.cmsOpenProfileFromFile.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
    cms.cmsOpenProfileFromFile.restype = ctypes.c_void_p
    cms.cmsCreate_sRGBProfile.restype = ctypes.c_void_p
    cms.cmsCreateXYZProfile.restype = ctypes.c_void_p
    cms.cmsCreateTransform.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_uint32]
    cms.cmsCreateTransform.restype = ctypes.c_void_p
    cms.cmsDoTransform.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32]
    cms.cmsDeleteTransform.argtypes = [ctypes.c_void_p]
    cms.cmsCloseProfile.argtypes = [ctypes.c_void_p]
    source = cms.cmsOpenProfileFromFile(arguments.source_icc.encode(), b"r")
    if not source:
        raise RuntimeError("Source ICC rejected")
    target = cms.cmsCreate_sRGBProfile() if arguments.target == "srgb" else cms.cmsCreateXYZProfile()
    rgb8 = (4 << 16) | (3 << 3) | 1
    xyz_double = (1 << 22) | (9 << 16) | (3 << 3)
    output_format = rgb8 if arguments.target == "srgb" else xyz_double
    intent = {"relative": 1, "perceptual": 0, "absolute": 3}[arguments.intent]
    transform = cms.cmsCreateTransform(source, rgb8, target, output_format, intent, 0x140)
    if not transform:
        cms.cmsCloseProfile(source)
        cms.cmsCloseProfile(target)
        raise RuntimeError("ICC transform unavailable")

    def convert(data):
        if len(data) % 3:
            raise ValueError("RGB24 input has incomplete pixel")
        count = len(data) // 3
        source_values = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
        result_type = ctypes.c_ubyte if arguments.target == "srgb" else ctypes.c_double
        result = (result_type * (count * 3))()
        cms.cmsDoTransform(transform, source_values, result, count)
        return list(result)

    try:
        if arguments.samples_rgb:
            triples = json.loads(arguments.samples_rgb)
            if not isinstance(triples, list) or not triples:
                raise ValueError("Expected nonempty RGB triple list")
            if any(not isinstance(row, list) or len(row) != 3 or any(type(v) is not int or v < 0 or v > 255 for v in row) for row in triples):
                raise ValueError("RGB sample channels must be integers from 0 to 255")
            values = convert(bytes(v for row in triples for v in row))
            with open(arguments.output, "x", encoding="utf8") as output:
                json.dump([values[i:i + 3] for i in range(0, len(values), 3)], output)
        else:
            with open(arguments.input_rgb, "rb") as source_file, open(arguments.output, "xb") as output:
                while True:
                    data = source_file.read(4096 * 3)
                    if not data:
                        break
                    values = convert(data)
                    output.write(bytes(values) if arguments.target == "srgb" else struct.pack("<" + "d" * len(values), *values))
    finally:
        cms.cmsDeleteTransform(transform)
        cms.cmsCloseProfile(source)
        cms.cmsCloseProfile(target)
    print("Reference transformation saved")

try:
    main()
except Exception:
    print("Reference transformation failed", file=sys.stderr)
    sys.exit(1)
