import inquirer from "inquirer";
import fs from "fs";
import path, { resolve } from "path";
import settings from "../settings";
import extra from "fs-extra";
import colors from "colors";
import decompress from "decompress";
import shelljs from "shelljs";
import packageJSON from "../package.json";

const q1 = { type: "confirm", name: "nwjs", message: "NWjs is ready" };

const linux = (obj, resolve, reject) => {  
  if (obj.package == "deb") {
    // hint 
    console.log(`\nYou need to download ${colors.yellow("NWjs")} from ${colors.green(obj.link)}\nand paste it here ${colors.green("file://"+path.resolve(__dirname, "../nwjs"))}\n`);
    const nwjsDir = path.resolve(__dirname, `../nwjs`);
    if (!fs.existsSync(nwjsDir)) fs.mkdirSync(nwjsDir);

    // ask about nwjs
    inquirer.prompt([q1]).then(ans => {
      if (ans.nwjs) {
        const mainDir = path.resolve(__dirname,"../desktop");
        const anatomy = {
          dirs: [
            path.resolve(__dirname, `../desktop/${packageJSON.name}/DEBIAN`),
            path.resolve(__dirname, `../desktop/${packageJSON.name}/usr/share/applications`),
            path.resolve(__dirname, `../desktop/${packageJSON.name}/opt/${packageJSON.name}`),
          ],
          files: [
            {
              path: path.resolve(__dirname, `../desktop/${packageJSON.name}/DEBIAN/control`),
              content: `Package: ${packageJSON.name}\nVersion: ${packageJSON.version}\nSection: base\nPriority: optional\nArchitecture: all\nInstalled-Size: SIZE\nDepends:\nMaintainer: ${packageJSON.author}\nDescription: ${packageJSON.description}\n\n`
            },
            {
              path: path.resolve(__dirname, `../desktop/${packageJSON.name}/DEBIAN/postinst`),
              content: `#!/bin/bash\nif [[ $EUID = 0 ]]; then\n  cp -r /usr/share/applications/${packageJSON.name}.desktop /home/$SUDO_USER/.local/share/applications\n  cd /opt/${packageJSON.name} && chmod 775 *\nfi`
            },
            {
              path: path.resolve(__dirname, `../desktop/${packageJSON.name}/usr/share/applications/${packageJSON.name}.desktop`),
              content: `[Desktop Entry]\nEncoding=UTF-8\nName=${packageJSON.name}\nComment=${packageJSON.name}\nExec=/opt/${packageJSON.name}/nw\nIcon=/opt/${packageJSON.name}/${settings.dest}/favicon.png\nCategories=Application\nType=Application\nTerminal=false`
            },
            {
              path: path.resolve(__dirname, `../desktop/${packageJSON.name}/opt/${packageJSON.name}/package.json`),
              content: JSON.stringify({
                name: packageJSON.name,
                version: packageJSON.version,
                description: packageJSON.description,
                main: settings.dest + "/index.html",
                window: {
                  toolbar: false,
                  title: packageJSON.name,
                  icon: settings.dest + "/favicon.png",
                  width: 1170,
                  height: 650,
                  min_width: 600,
                  min_height: 580,
                  position: "center",
                  "background-color": "#a69aa6"
                },
                "chromium-args": "--disable-web-security"
              },null,2)
            },
          ]
        };
      
        // clearn dekstop folder
        if (fs.existsSync(mainDir)) fs.rmdirSync(mainDir, { recursive: true });
    
        // create anatomy
        console.log(colors.yellow("\nInitializing debian anatomy..."));
    
        // directories
        anatomy.dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
    
        // files
        anatomy.files.forEach(obj_ => {
          fs.writeFile(obj_.path, obj_.content, err => {
            if (err) {
              console.error(colors.red(err));
              return reject();
            }
            const arr = obj_.path.split("/");
            const fileName = arr[arr.length-1];
            console.log(` ${fileName} ${colors.green("[Done]")}`);
          });
        });
    
        // copy build folder 
        const buildSrc = path.resolve(__dirname, `../${settings.dest}`);
        const buildDest = path.resolve(__dirname, `../desktop/${packageJSON.name}/opt/${packageJSON.name}/${settings.dest}`);
        extra.copy(buildSrc, buildDest, err => {
          if (err) {
            console.error(colors.red(err));
            return reject();
          }
          console.log(colors.yellow(`\nCloning ${settings.dest} directory...`));
    
          // Extracting
          const nwjsSrc = path.resolve(__dirname, "../nwjs/" + obj.file);
          const nwjsDest = path.resolve(__dirname, `../desktop/${packageJSON.name}/opt/${packageJSON.name}`);
          if (!fs.existsSync(nwjsSrc)) {
            console.error(colors.red("\nCouldn't find " + obj.file));
            return reject();
          }

          console.log(colors.yellow(`Extracting ${obj.file}...`));
          decompress(nwjsSrc, path.resolve(__dirname, "../nwjs")).then(files => {
            // Cloning nwjs
            console.log(colors.yellow(`Cloning ${obj.file}...`));
            extra.copy(path.resolve(__dirname, `../nwjs/${obj.dir}/`), nwjsDest, err => {
              if (err) {
                console.error(colors.red(err));
                return reject();
              }
              
              // packaging
              const debPath = path.resolve(__dirname, `../desktop/${packageJSON.name}/DEBIAN`);
              const chmod = "chmod 755 *";
              const dpkg = `dpkg-deb --build ${packageJSON.name}`;
              const dpkgCheck = "whereis dpkg-deb";
              shelljs.exec(dpkgCheck , {silent:true},(code, stdout, stderr) => {
                if (stderr) {
                  console.error(colors.red(stderr));
                  return reject();
                }

                if (stdout === "dpkg-deb:\n") {
                  console.log(colors.red("dpkg-deb is not installed"));
                  return reject();
                } else {
                  console.log(colors.green(`Packaging...`));
                  shelljs.exec(`cd ${debPath} && ${chmod} && cd ../../ && ${dpkg}`, {silent:true}, (code, stdout, stderr) => {
                    if (stderr) {
                      console.error(colors.red(stderr));
                      return reject();
                    }

                    console.log(colors.cyan(`Get your debian package from file://${path.resolve(__dirname, `../desktop`)}`));
                    resolve();
                  });
                }
              });

            });
          });
        });
        
      } else {
        console.error(colors.red("Can't proceed unless NWjs is ready"));
        return reject();
      }
    }).catch(reject);

  } else if (obj.package == "rpm") {
    console.log(colors.red("Not implemented yet!"));
    resolve();
  }
};

export default linux;