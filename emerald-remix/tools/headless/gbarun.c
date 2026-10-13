// Headless GBA runner for checking builds without a screen, built on libmgba.
//
// Usage: gbarun ROM < script
// Script lines:
//   wait N              run N frames with no buttons held
//   press KEYS [N] [G]  hold KEYS (e.g. A, START, A+B) for N frames (default 2), then release
//                       for G frames (default 20)
//   repeat COUNT KEYS   press KEYS COUNT times with the default timing
//   shot FILE.ppm       save the current screen
//   save FILE / load FILE   write / read a savestate
// Keys: A B SELECT START RIGHT LEFT UP DOWN R L
#include <mgba/core/core.h>
#include <mgba/core/log.h>
#include <mgba/core/serialize.h>
#include <mgba/gba/interface.h>
#include <mgba-util/vfs.h>

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static struct mCore* core;

static void quietLog(struct mLogger* logger, int category, enum mLogLevel level, const char* format, va_list args) {
	(void) logger; (void) category; (void) level; (void) format; (void) args;
}
static struct mLogger quiet = { .log = quietLog };
static color_t* buffer;

static int keyMask(const char* spec) {
	static const char* names[] = { "A", "B", "SELECT", "START", "RIGHT", "LEFT", "UP", "DOWN", "R", "L" };
	int mask = 0;
	char copy[64];
	strncpy(copy, spec, sizeof(copy) - 1);
	copy[sizeof(copy) - 1] = 0;
	for (char* tok = strtok(copy, "+"); tok; tok = strtok(NULL, "+")) {
		int found = 0;
		for (int i = 0; i < 10; ++i) {
			if (!strcmp(tok, names[i])) {
				mask |= 1 << i;
				found = 1;
			}
		}
		if (!found) {
			fprintf(stderr, "unknown key %s\n", tok);
			exit(1);
		}
	}
	return mask;
}

static void run(int frames, int keys) {
	core->setKeys(core, keys);
	for (int i = 0; i < frames; ++i) {
		core->runFrame(core);
	}
	core->setKeys(core, 0);
}

static void shot(const char* path) {
	unsigned w, h;
	core->desiredVideoDimensions(core, &w, &h);
	FILE* f = fopen(path, "wb");
	fprintf(f, "P6\n%u %u\n255\n", w, h);
	for (unsigned y = 0; y < h; ++y) {
		for (unsigned x = 0; x < w; ++x) {
			color_t c = buffer[y * w + x];
			unsigned char px[3] = { c & 0xFF, (c >> 8) & 0xFF, (c >> 16) & 0xFF };
			fwrite(px, 1, 3, f);
		}
	}
	fclose(f);
}

int main(int argc, char** argv) {
	if (argc != 2) {
		fprintf(stderr, "usage: %s ROM < script\n", argv[0]);
		return 1;
	}
	mLogSetDefaultLogger(&quiet);
	core = mCoreFind(argv[1]);
	if (!core || !core->init(core)) {
		fprintf(stderr, "could not load %s\n", argv[1]);
		return 1;
	}
	mCoreInitConfig(core, NULL);
	unsigned w, h;
	core->desiredVideoDimensions(core, &w, &h);
	buffer = calloc(w * h, sizeof(color_t));
	core->setVideoBuffer(core, buffer, w);
	if (!mCoreLoadFile(core, argv[1])) {
		fprintf(stderr, "could not load ROM\n");
		return 1;
	}
	core->reset(core);

	char line[256];
	while (fgets(line, sizeof(line), stdin)) {
		char cmd[32] = "", a[128] = "", b[64] = "", c[64] = "";
		if (sscanf(line, "%31s %127s %63s %63s", cmd, a, b, c) < 1 || cmd[0] == '#') {
			continue;
		}
		if (!strcmp(cmd, "wait")) {
			run(atoi(a), 0);
		} else if (!strcmp(cmd, "press")) {
			run(b[0] ? atoi(b) : 2, keyMask(a));
			run(c[0] ? atoi(c) : 20, 0);
		} else if (!strcmp(cmd, "repeat")) {
			for (int i = atoi(a); i > 0; --i) {
				run(2, keyMask(b));
				run(20, 0);
			}
		} else if (!strcmp(cmd, "shot")) {
			shot(a);
		} else if (!strcmp(cmd, "save") || !strcmp(cmd, "load")) {
			int saving = cmd[0] == 's';
			struct VFile* vf = VFileOpen(a, saving ? O_CREAT | O_TRUNC | O_RDWR : O_RDONLY);
			if (!vf || !(saving ? mCoreSaveStateNamed(core, vf, SAVESTATE_SAVEDATA | SAVESTATE_RTC)
			                    : mCoreLoadStateNamed(core, vf, SAVESTATE_SAVEDATA | SAVESTATE_RTC))) {
				fprintf(stderr, "%s failed: %s\n", cmd, a);
				return 1;
			}
			vf->close(vf);
		} else {
			fprintf(stderr, "unknown command %s\n", cmd);
			return 1;
		}
	}
	core->deinit(core);
	return 0;
}
