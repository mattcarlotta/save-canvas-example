/* eslint-disable */
import React, { useCallback, useEffect, useState, useRef } from "react";
import classNames from "classnames";
import copy from "copy-to-clipboard";
import jsPDF from "jspdf";
import axios from "axios";
import { fabric } from "fabric";
import fabricConfig from "./fabricConfig";
import imageAPI from "./utils/axiosConfig";
import getRatio from "./utils/getRatio";
import getUrlSearchParams from "./utils/getUrlSearchParams";
import setAttributes from "./utils/setAttributes";

const { REACT_APP_IMAGE_BASEURL } = process.env;

const Canvas = () => {
  // State
  const [HTML5Canvas, setCanvas] = useState(null);
  const [isToolkitOpen, setIsToolkitOpen] = useState(false);
  const [canvasDisabled, setCanvasDisabled] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [imageFile, setImageFile] = useState({
    filepath: "",
    ext: "",
  });
  const [imageError, setImageError] = useState("");
  const [, setSteps] = useState({
    steps: [],
    currentStep: -1,
  });
  // Ref
  const colorRef = useRef(null);
  const canvasRef = useRef(null);
  const { filepath, ext } = imageFile;
  const srcImage = `${REACT_APP_IMAGE_BASEURL}${filepath}`;
  // Functions

  const loadImageFromUrl = useCallback((canvas) => {
    // Load an SVG from GET parameter upon initialization of image editor
    const imageUrl = "https://maxhenryxie.com/img/girl_small_1MB.svg";

    if (imageUrl) {
      new Promise((resolve) =>
        fabric.loadSVGFromURL(imageUrl, (objects, options) => {
          const group = new fabric.Group(objects);
          resolve(getRatio(group, canvas));
        })
      ).then(({ ratio, width, height }) => {
        fabric.loadSVGFromURL(imageUrl, (objects, options) => {
          try {
            // Get all GET parameter Keys and store in dicts
            var urlParams = getUrlSearchParams();
            const objectPropertiesDict = {};
            const objectIdArray = [];
            objects.forEach((obj) => {
              objectIdArray.push(obj.id);
            });
            // Loop through the keys
            for (var key of urlParams.keys()) {
              if (key != "image_id" && objectIdArray.includes(key)) {
                var value = urlParams.get(key);
                value = value.replace("r", ',"r":');
                value = value.replace("g", ',"g":');
                value = value.replace("b", ',"b":');
                if (value[0] == ",") {
                  value = value.substring(1);
                }
                var valueDict = JSON.parse("{" + value + "}");
                valueDict["r"] = valueDict["r"] / 100;
                valueDict["g"] = valueDict["g"] / 100;
                valueDict["b"] = valueDict["b"] / 100;
                objectPropertiesDict[key] = valueDict;
              }
            }

            objects.forEach((obj) => {
              setAttributes(obj, {
                hoverCursor: "pointer",
                perPixelTargetFind: true,
                left:
                  obj.left * ratio + (canvas.width / 2 - (width * ratio) / 2),
                top:
                  obj.top * ratio + (canvas.height / 2 - (height * ratio) / 2),
              });
              //Display bbox when hovering the object
              obj.on("mouseover", function () {
                this._renderControls(this.canvas.contextTop, {
                  borderColor: "#CAAA9F",
                  hasControls: false,
                });
              });
              obj.on("mousedown", function () {
                this.canvas.clearContext(this.canvas.contextTop);
              });
              obj.on("mouseout", function () {
                this.canvas.clearContext(this.canvas.contextTop);
              });
              obj.scale(ratio);
              if (objectPropertiesDict[obj.id] !== undefined) {
                const r = objectPropertiesDict[obj.id].r;
                const g = objectPropertiesDict[obj.id].g;
                const b = objectPropertiesDict[obj.id].b;
                const filter = new fabric.Image.filters.ColorMatrix({
                  matrix: [
                    r,
                    r,
                    r,
                    r,
                    0.0,
                    g,
                    g,
                    g,
                    g,
                    0.0,
                    b,
                    b,
                    b,
                    b,
                    0.0,
                    1.0,
                    1.0,
                    1.0,
                    1.0,
                    0.0,
                  ],
                });
                if (obj.filters) {
                  obj.filters.length = 0;
                  obj.filters.push(filter);
                  obj.applyFilters();
                }
              }
              // add filter here to obj
              canvas.add(obj);
            });
            canvas.renderAll();

            //THIS IS THE CRUCIAL BIT, IF THE USER ACCESSES THE APP WITH AN "EXPORT" GET PARAMETER WE WANT TO SEND
            //BACK THE IMAGE THAT THEY CAN USE IN THEIR <IMG SRC="WWW.REACT_APP.COM"> TAG
            let canvasImg = "";
            if (urlParams.get("export") === "png") {
              canvasImg = canvas.toDataURL("image/png");
            } else if (urlParams.get("export") === "pdf") {
              canvasImg = canvas.toDataURL("image/pdf");
            } else {
              console.log("No export was selected, proceed as normal");
            }
          } catch (err) {
            console.log("Could not retrieve that image");
          }
        });
      });
    }
  }, []);

  const handleSaveImage = async (ext) => {
    if (canvasRef && canvasRef.current) {
      try {
        const isPDF = ext === "pdf";

        // reset any previous image upload errors
        setImageError("");

        // convert canvas to base64 encoded image
        const base64Image = canvasRef.current.toDataURL("image/png");

        let res;
        if (isPDF) {
          // if saving as PDF, convert base64 to image to get width and height
          // then convert to blob
          res = await new Promise((resolve, reject) => {
            const img = new Image();
            img.src = base64Image;
            img.onload = () => {
              // add image to PDF
              const doc = new jsPDF().addImage(
                base64Image,
                "png",
                0,
                0,
                img.width,
                img.height
              );
              // convert PDF to blob
              resolve({ data: doc.output("blob") });
            };
            img.onerror = (err) => reject(err);
          });
        } else {
          // if png, convert base64 to blob
          res = await axios(base64Image, { responseType: "blob" });
        }

        // convert blob to a file that can be uploaded
        const file = new File([res.data], `preview.${ext}`, {
          type: isPDF ? "application/pdf" : `image/png`,
        });

        // attach file to formdata
        const form = new FormData();
        form.append("file", file);

        // send formdata to image CDN
        // image CDN returns a string
        res = await imageAPI.post("upload-file", form);

        // set filepath string to state
        setImageFile({ filepath: res.data.filepath, ext });
      } catch (err) {
        // set upload errors to state
        setImageError(err.toString());
      }
    }
  };

  const handleResetImage = () => {
    setImageFile({ filepath: "", ext: "" });
  };

  const copyToClipboard = () => {
    copy(srcImage);
    alert("Copied URL to clipboard!");
  };

  // Use Effects
  useEffect(() => {
    const canvas = new fabric.Canvas("canvas", {
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
    });
    loadImageFromUrl(canvas);
    // eslint-disable-next-line
  }, []);

  return (
    <div className="app">
      <div className={classNames("Canvas", { isMobile })}>
        <div className="Canvas_Desktop">
          <canvas ref={canvasRef} id="canvas" />
        </div>
        {!filepath ? (
          <>
            <button
              style={{ marginRight: 10 }}
              type="button"
              onClick={() => handleSaveImage("png")}
            >
              Save Image
            </button>
            <button type="button" onClick={() => handleSaveImage("pdf")}>
              Save PDF
            </button>
          </>
        ) : (
          <button type="button" onClick={handleResetImage}>
            Reset
          </button>
        )}
        <div>
          {imageError && <p className="error">{imageError}</p>}
          {filepath && (
            <>
              <h1 className="success">Image was successfully uploaded!</h1>
              <div>
                Shareable link:&nbsp;
                <pre>
                  <code>{srcImage}</code>
                </pre>
                <button type="button" onClick={copyToClipboard}>
                  Copy To Clipboard
                </button>
                <br />
                <br />
                <a href={srcImage} target="__blank">
                  Open Image In New Tab
                </a>
              </div>
              <h2>Preview</h2>
              {ext === "png" ? (
                <img src={srcImage} alt="preview" />
              ) : (
                <embed
                  src={srcImage}
                  type="application/pdf"
                  frameBorder="0"
                  scrolling="auto"
                  height="300px"
                  width="300px"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Canvas;
