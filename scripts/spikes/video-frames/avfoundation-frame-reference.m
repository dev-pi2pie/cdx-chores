// Development-only macOS reference. Caller owns the empty output directory and all results.
#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

static int fail(NSString *kind) {
    fprintf(stderr, "Native frame reference failed: %s\n", kind.UTF8String);
    return 1;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc == 2 && strcmp(argv[1], "--help") == 0) {
            puts("--input <video> --output-dir <existing empty directory> --seconds <decimal>");
            return 0;
        }
        if (argc != 7) return fail(@"arguments");
        NSMutableDictionary<NSString *, NSString *> *options = [NSMutableDictionary dictionary];
        for (int index = 1; index < argc; index += 2) options[@(argv[index])] = @(argv[index + 1]);
        NSSet *keys = [NSSet setWithArray:options.allKeys];
        if (![keys isEqualToSet:[NSSet setWithArray:@[@"--input", @"--output-dir", @"--seconds"]]]) return fail(@"arguments");
        NSScanner *scanner = [NSScanner scannerWithString:options[@"--seconds"]];
        double seconds;
        if (![scanner scanDouble:&seconds] || !scanner.isAtEnd || !isfinite(seconds) || seconds < 0) return fail(@"time");
        NSURL *input = [NSURL fileURLWithPath:options[@"--input"]].standardizedURL;
        NSURL *output = [NSURL fileURLWithPath:options[@"--output-dir"] isDirectory:YES].standardizedURL;
        NSFileManager *files = NSFileManager.defaultManager;
        BOOL directory = NO;
        NSError *error = nil;
        NSArray *contents = [files contentsOfDirectoryAtPath:output.path error:&error];
        if (![files fileExistsAtPath:output.path isDirectory:&directory] || !directory || error || contents.count != 0 ||
            [output isEqual:input.URLByDeletingLastPathComponent] || [input.path hasPrefix:[output.path stringByAppendingString:@"/"]]) return fail(@"output directory");

        AVURLAsset *asset = [AVURLAsset URLAssetWithURL:input options:nil];
        AVAssetImageGenerator *generator = [[AVAssetImageGenerator alloc] initWithAsset:asset];
        generator.appliesPreferredTrackTransform = YES;
        generator.requestedTimeToleranceBefore = kCMTimeZero;
        generator.requestedTimeToleranceAfter = kCMTimeZero;
        if (@available(macOS 15.0, *)) generator.dynamicRangePolicy = AVAssetImageGeneratorDynamicRangePolicyMatchSource;
        CMTime requested = CMTimeMakeWithSeconds(seconds, 600000);
        CMTime actual = kCMTimeInvalid;
        // Synchronous API keeps one frame bounded. Present in the installed SDK, deprecated.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        CGImageRef image = [generator copyCGImageAtTime:requested actualTime:&actual error:&error];
#pragma clang diagnostic pop
        if (!image || error) return fail(@"frame generation");
        NSURL *png = [output URLByAppendingPathComponent:@"native-frame.png"];
        CGImageDestinationRef destination = CGImageDestinationCreateWithURL((__bridge CFURLRef)png, CFSTR("public.png"), 1, NULL);
        if (!destination) { CGImageRelease(image); return fail(@"PNG destination"); }
        // Supply the original image and no replacement color space/profile or rendering target.
        CGImageDestinationAddImage(destination, image, NULL);
        BOOL finalized = CGImageDestinationFinalize(destination);
        CFRelease(destination);
        if (!finalized) { CGImageRelease(image); return fail(@"PNG write"); }
        CGColorSpaceRef colorSpace = CGImageGetColorSpace(image);
        NSData *icc = nil;
        if (colorSpace) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
            icc = CFBridgingRelease(CGColorSpaceCopyICCData(colorSpace));
#pragma clang diagnostic pop
        }
        if (icc && ![icc writeToURL:[output URLByAppendingPathComponent:@"native-color-space.icc"] options:NSDataWritingWithoutOverwriting error:&error]) {
            CGImageRelease(image); return fail(@"ICC write");
        }
        NSData *provider = CFBridgingRelease(CGDataProviderCopyData(CGImageGetDataProvider(image)));
        if (!provider || ![provider writeToURL:[output URLByAppendingPathComponent:@"native-provider.bin"] options:NSDataWritingWithoutOverwriting error:&error]) {
            CGImageRelease(image); return fail(@"pixel write");
        }
        NSString *name = colorSpace ? CFBridgingRelease(CGColorSpaceCopyName(colorSpace)) : @"unavailable";
        NSDictionary *description = @{
            @"requestedSeconds": @(seconds), @"requestedTimeValue": @(requested.value), @"requestedTimeScale": @(requested.timescale),
            @"actualTimeValue": @(actual.value), @"actualTimeScale": @(actual.timescale), @"actualSeconds": @(CMTimeGetSeconds(actual)),
            @"width": @(CGImageGetWidth(image)), @"height": @(CGImageGetHeight(image)), @"bitsPerComponent": @(CGImageGetBitsPerComponent(image)),
            @"bitsPerPixel": @(CGImageGetBitsPerPixel(image)), @"bytesPerRow": @(CGImageGetBytesPerRow(image)),
            @"alphaInfo": @(CGImageGetAlphaInfo(image)), @"bitmapInfo": @(CGImageGetBitmapInfo(image)), @"renderingIntent": @(CGImageGetRenderingIntent(image)),
            @"colorSpaceName": name ?: @"unavailable", @"colorSpaceModel": @(colorSpace ? CGColorSpaceGetModel(colorSpace) : -1),
            @"colorComponents": @(colorSpace ? CGColorSpaceGetNumberOfComponents(colorSpace) : 0), @"iccPresent": @(icc != nil), @"iccBytes": @(icc.length),
            @"preferredTrackTransformApplied": @YES, @"dynamicRangePolicy": @"matchSource on macOS 15+", @"profileSubstitutionRequested": @NO
        };
        NSData *json = [NSJSONSerialization dataWithJSONObject:description options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys error:&error];
        BOOL written = json && [json writeToURL:[output URLByAppendingPathComponent:@"native-reference.json"] options:NSDataWritingWithoutOverwriting error:&error];
        CGImageRelease(image);
        if (!written) return fail(@"description write");
        puts("Native frame reference saved");
        return 0;
    }
}
