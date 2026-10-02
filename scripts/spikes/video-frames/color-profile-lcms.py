"""Opt-in independent ICC interpretation using an already-installed LittleCMS library."""
import ctypes
import ctypes.util
import json
import math
import sys

library = ctypes.util.find_library("lcms2")
if library is None:
    raise RuntimeError("LittleCMS unavailable; independent CMM interpretation not tested")
cms = ctypes.CDLL(library)
cms.cmsOpenProfileFromFile.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
cms.cmsOpenProfileFromFile.restype = ctypes.c_void_p
cms.cmsCreateXYZProfile.restype = ctypes.c_void_p
cms.cmsCreateTransform.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_uint32]
cms.cmsCreateTransform.restype = ctypes.c_void_p
cms.cmsDoTransform.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32]
cms.cmsDeleteTransform.argtypes = [ctypes.c_void_p]
cms.cmsCloseProfile.argtypes = [ctypes.c_void_p]
cms.cmsMD5computeID.argtypes = [ctypes.c_void_p]
cms.cmsGetHeaderProfileID.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
profile = cms.cmsOpenProfileFromFile(sys.argv[1].encode(), b"r")
if not profile:
    raise RuntimeError("LittleCMS rejected profile")
with open(sys.argv[1], "rb") as source_file:
    source_profile = source_file.read()
if not cms.cmsMD5computeID(profile):
    raise RuntimeError("LittleCMS cannot calculate ICC profile ID")
digest = (ctypes.c_ubyte * 16)()
cms.cmsGetHeaderProfileID(profile, digest)
if bytes(digest) != source_profile[84:100]:
    raise AssertionError("ICC profile ID disagrees with independent LittleCMS calculation")
xyz_profile = cms.cmsCreateXYZProfile()
# TYPE_RGB_DBL and TYPE_XYZ_DBL from lcms2.h. Relative colorimetric, no caching/optimization.
transform = cms.cmsCreateTransform(profile, (1 << 22) | (4 << 16) | (3 << 3), xyz_profile, (1 << 22) | (9 << 16) | (3 << 3), 1, 0x140)
if not transform:
    raise RuntimeError("LittleCMS cannot create matrix/TRC transform")
transfer = sys.argv[2]
probes = [(0, 0, 0), (19/255, 19/255, 19/255), (0.5, 0.5, 0.5), (1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 1)]
matrix = [(0.4360747, 0.3850649, 0.1430804), (0.2225045, 0.7168786, 0.0606169), (0.0139322, 0.0971045, 0.7141733)]
def decode(v):
    if transfer == "bt709":
        # Native CoreMedia709 image interpretation, independently checked by the display proof.
        return v ** (502 / 256)
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

maximum_error = 0
measurements = []
try:
    for probe in probes:
        source = (ctypes.c_double * 3)(*probe)
        actual = (ctypes.c_double * 3)()
        cms.cmsDoTransform(transform, source, actual, 1)
        linear = [decode(value) for value in probe]
        expected = [sum(row[i] * linear[i] for i in range(3)) for row in matrix]
        error = max(abs(actual[i] - expected[i]) for i in range(3))
        if not math.isfinite(error) or error > 0.00006:
            raise AssertionError((probe, list(actual), expected, error))
        maximum_error = max(maximum_error, error)
        measurements.append({"rgb": probe, "xyz": list(actual)})
finally:
    cms.cmsDeleteTransform(transform)
    cms.cmsCloseProfile(profile)
    cms.cmsCloseProfile(xyz_profile)
print(json.dumps({"independentCMM": "LittleCMS", "profileID": "verified", "transfer": transfer, "maximumXYZError": maximum_error, "measurements": measurements}))
