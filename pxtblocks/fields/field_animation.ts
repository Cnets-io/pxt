/// <reference path="../../built/pxtlib.d.ts" />
/// <reference path="./field_asset.ts" />

namespace pxtblockly {
    import svg = pxt.svgUtil;

    export interface FieldAnimationOptions {
        initWidth: string;
        initHeight: string;
        disableResize: string;

        filter?: string;
    }

    export interface ParsedFieldAnimationOptions {
        initWidth: number;
        initHeight: number;
        disableResize: boolean;
        filter?: string;
    }

    // 32 is specifically chosen so that we can scale the images for the default
    // sprite sizes without getting browser anti-aliasing
    const PREVIEW_WIDTH = 32;
    const X_PADDING = 5;
    const Y_PADDING = 1;
    const BG_PADDING = 4;
    const BG_WIDTH = BG_PADDING * 2 + PREVIEW_WIDTH;
    const ICON_WIDTH = 30;
    const TOTAL_HEIGHT = Y_PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH;
    const TOTAL_WIDTH = X_PADDING * 2 + BG_PADDING * 2 + PREVIEW_WIDTH + ICON_WIDTH;

    export class FieldAnimationEditor extends FieldAssetEditor<FieldAnimationOptions, ParsedFieldAnimationOptions> {
        protected frames: string[];
        protected preview: svg.Image;
        protected animateRef: any;
        protected asset: pxt.Animation;
        protected initInterval: number;

        init() {
            if (this.fieldGroup_) {
                // Field has already been initialized once.
                return;
            }

            super.init();

            // Register mouseover events for animating preview
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().addEventListener("mouseenter", this.onMouseEnter);
            (this.sourceBlock_ as Blockly.BlockSvg).getSvgRoot().addEventListener("mouseleave", this.onMouseLeave);
        }

        showEditor_() {
            // Read parent interval
            if (this.asset) {
                this.asset.interval = this.getParentInterval() || this.asset.interval;
            }

            super.showEditor_();
        }

        render_() {
            super.render_();
            this.size_.height = TOTAL_HEIGHT
            this.size_.width = TOTAL_WIDTH;
        }

        protected getAssetType(): pxt.AssetType {
            return pxt.AssetType.Animation;
        }

        protected createNewAsset(text?: string): pxt.Asset {
            const project = pxt.react.getTilemapProject();

            if (text) {
                const match = /^\s*assets\s*\.\s*animation\s*`([^`]+)`\s*$/.exec(text);
                if (match) {
                    const asset = project.lookupAssetByName(pxt.AssetType.Animation, match[1].trim());
                    if (asset) return asset;
                }

                const frames = parseImageArrayString(text);

                if (frames && frames.length) {
                    return project.createNewAnimationFromData(frames, this.getParentInterval());
                }

                const asset = project.lookupAssetByName(pxt.AssetType.Animation, text.trim());
                    if (asset) return asset;
            }

            return project.createNewAnimation(this.params.initWidth, this.params.initHeight);
        }

        protected onEditorClose(newValue: pxt.Animation) {
            this.setParentInterval(newValue.interval);
        }

        protected getValueText(): string {
            if (!this.asset) return "[]";

            if (this.isTemporaryAsset()) {
                return "[" + this.asset.frames.map(frame =>
                    pxt.sprite.bitmapToImageLiteral(pxt.sprite.Bitmap.fromData(frame), pxt.editor.FileType.TypeScript)
                ).join(",") + "]"
            }

            return `assets.animation\`${this.asset.meta.displayName || pxt.getShortIDForAsset(this.asset)}\``
        }

        protected redrawPreview() {
            if (!this.fieldGroup_) return;
            pxsim.U.clear(this.fieldGroup_);

            const bg = new svg.Rect()
                .at(X_PADDING + ICON_WIDTH, Y_PADDING)
                .size(BG_WIDTH, BG_WIDTH)
                .corner(4)
                .setClass("blocklyAnimationField");

            this.fieldGroup_.appendChild(bg.el);

            const icon = new svg.Text("\uf008")
                .at(X_PADDING, 5 + (TOTAL_HEIGHT >> 1))
                .fill((this.sourceBlock_ as Blockly.BlockSvg).getColourSecondary())
                .setClass("semanticIcon");

            this.fieldGroup_.appendChild(icon.el);

            if (this.asset) {
                this.frames = this.asset.frames.map(frame => bitmapToImageURI(pxt.sprite.Bitmap.fromData(frame), PREVIEW_WIDTH, this.lightMode));
                this.preview = new svg.Image()
                    .src(this.frames[0])
                    .at(X_PADDING + BG_PADDING + ICON_WIDTH, Y_PADDING + BG_PADDING)
                    .size(PREVIEW_WIDTH, PREVIEW_WIDTH);
                this.fieldGroup_.appendChild(this.preview.el);
            }
        }

        protected onMouseEnter = () => {
            if (this.animateRef || !this.asset) return;

            const assetInterval = this.getParentInterval() || this.asset.interval;

            const interval = assetInterval > 50 ? assetInterval : 50;

            let index = 0;
            this.animateRef = setInterval(() => {
                if (this.preview && this.frames[index]) this.preview.src(this.frames[index]);
                index = (index + 1) % this.frames.length;
            }, interval);
        }

        protected onMouseLeave = () => {
            if (this.animateRef) clearInterval(this.animateRef);
            this.animateRef = undefined;

            if (this.preview && this.frames[0]) {
                this.preview.src(this.frames[0]);
            }
        }

        protected getParentIntervalBlock(): Blockly.Block {
            const s = this.sourceBlock_;
            if (s.parentBlock_) {
                const p = s.parentBlock_;
                for (const input of p.inputList) {
                    if (input.name === "frameInterval") {
                        return input.connection.targetBlock();
                    }
                }
            }

            return undefined;
        }

        protected setParentInterval(interval: number) {
            const target = this.getParentIntervalBlock();

            if (target) {
                const fieldName = getFieldName(target);
                if (fieldName) {
                    target.setFieldValue(String(interval), fieldName);
                }
            }
        }

        protected getParentInterval() {
            const target = this.getParentIntervalBlock();

            if (target) {
                const fieldName = getFieldName(target);
                if (fieldName) {
                    return Number(target.getFieldValue(fieldName))
                }
            }

            return 100;
        }

        protected parseFieldOptions(opts: FieldAnimationOptions): ParsedFieldAnimationOptions {
            return parseFieldOptions(opts);
        }
    }

    function parseFieldOptions(opts: FieldAnimationOptions) {
        const parsed: ParsedFieldAnimationOptions = {
            initWidth: 16,
            initHeight: 16,
            disableResize: false
        };

        if (!opts) {
            return parsed;
        }

        if (opts.filter) {
            parsed.filter = opts.filter;
        }

        parsed.initWidth = withDefault(opts.initWidth, parsed.initWidth);
        parsed.initHeight = withDefault(opts.initHeight, parsed.initHeight);

        return parsed;

        function withDefault(raw: string, def: number) {
            const res = parseInt(raw);
            if (isNaN(res)) {
                return def;
            }
            return res;
        }
    }

    function parseImageArrayString(str: string): pxt.sprite.BitmapData[] {
        if (str.indexOf("[") === -1) return null;
        str = str.replace(/[\[\]]/mg, "");
        return str.split(",").map(s => pxt.sprite.imageLiteralToBitmap(s).data()).filter(b => b.height && b.width);
    }

    function isNumberType(type: string) {
        return type === "math_number" || type === "math_integer" || type === "math_whole_number";
    }

    function getFieldName(target: Blockly.Block) {
        if (target.type === "math_number_minmax") {
            return "SLIDER";
        }
        else if (isNumberType(target.type)) {
            return "NUM";
        }
        else if (target.type === "timePicker") {
            return "ms";
        }

        return null;
    }
}