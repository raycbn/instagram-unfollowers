const zipInput = document.getElementById("zipInput");
const status = document.getElementById("status");

const stats = document.getElementById("stats");
const results = document.getElementById("results");

const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const notFollowingCount = document.getElementById("notFollowingCount");

const userList = document.getElementById("userList");
const search = document.getElementById("search");

const selectAll = document.getElementById("selectAll");
const clearAll = document.getElementById("clearAll");

const debug = document.getElementById("debug");
const debugContent = document.getElementById("debugContent");

let notFollowingUsers = [];


/* ========================================
   CARGAR ZIP
======================================== */

zipInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

        status.textContent =
            "⏳ Abriendo ZIP de Instagram...";

        const zip =
            await JSZip.loadAsync(file);

        const allFiles =
            Object.keys(zip.files);

        console.log(
            "ARCHIVOS DEL ZIP:",
            allFiles
        );


        /*
        ========================================
        BUSCAR ARCHIVOS DE RELACIONES
        ========================================
        */

        const jsonFiles =
            allFiles.filter(path =>
                path.toLowerCase().endsWith(".json")
            );


        const relationshipFiles = [];


        for (const path of jsonFiles) {

            const name =
                path.split("/").pop().toLowerCase();


            /*
            Solo examinamos archivos que
            tengan alguna relación con
            followers/following/connections.
            */

            if (
                name.includes("follow") ||
                name.includes("relationship")
            ) {

                relationshipFiles.push(path);

            }

        }


        /*
        ========================================
        MOSTRAR DEBUG
        ========================================
        */

        debug.classList.remove("hidden");

        debugContent.innerHTML = `
            <p><strong>JSON encontrados:</strong> ${jsonFiles.length}</p>
            <p><strong>Archivos relacionados:</strong> ${relationshipFiles.length}</p>
            <details>
                <summary>Ver archivos detectados</summary>
                <pre>${escapeHtml(
                    relationshipFiles.join("\n")
                )}</pre>
            </details>
        `;


        /*
        ========================================
        BUSCAR FOLLOWERS Y FOLLOWING
        POR EL CONTENIDO REAL
        ========================================
        */

        let followers = new Set();
        let following = new Set();

        let followersDetected = [];
        let followingDetected = [];


        for (
            const path of relationshipFiles
        ) {

            const zipFile =
                zip.files[path];

            if (
                !zipFile ||
                zipFile.dir
            ) {
                continue;
            }


            let content;

            try {

                content =
                    await zipFile.async("string");

            } catch {

                continue;

            }


            let data;

            try {

                data =
                    JSON.parse(content);

            } catch {

                continue;

            }


            /*
            Convertimos todo el JSON
            en un texto para detectar
            la clave real.
            */

            const jsonText =
                JSON.stringify(data)
                    .toLowerCase();


            /*
            ========================================
            FOLLOWERS
            ========================================
            */

            if (
                jsonText.includes(
                    "relationships_followers"
                )
            ) {

                const users =
                    extractUsernames(data);

                users.forEach(user =>
                    followers.add(user)
                );

                followersDetected.push(
                    path
                );

                continue;
            }


            /*
            ========================================
            FOLLOWING
            ========================================
            */

            if (
                jsonText.includes(
                    "relationships_following"
                )
            ) {

                const users =
                    extractUsernames(data);

                users.forEach(user =>
                    following.add(user)
                );

                followingDetected.push(
                    path
                );

                continue;
            }


            /*
            ========================================
            FORMATO ALTERNATIVO
            ========================================
            */

            const fileName =
                path
                    .split("/")
                    .pop()
                    .toLowerCase();


            if (
                fileName.startsWith("followers")
            ) {

                const users =
                    extractUsernames(data);

                users.forEach(user =>
                    followers.add(user)
                );

                followersDetected.push(
                    path
                );

            }


            if (
                fileName.startsWith("following")
            ) {

                const users =
                    extractUsernames(data);

                users.forEach(user =>
                    following.add(user)
                );

                followingDetected.push(
                    path
                );

            }

        }


        /*
        ========================================
        ACTUALIZAR DEBUG
        ========================================
        */

        debugContent.innerHTML += `

            <hr>

            <p>
                <strong>Followers detectados:</strong>
                ${followersDetected.length}
            </p>

            <p>
                <strong>Following detectados:</strong>
                ${followingDetected.length}
            </p>

            <details>
                <summary>Archivos de followers</summary>
                <pre>${escapeHtml(
                    followersDetected.join("\n")
                )}</pre>
            </details>

            <details>
                <summary>Archivos de following</summary>
                <pre>${escapeHtml(
                    followingDetected.join("\n")
                )}</pre>
            </details>
        `;


        /*
        ========================================
        COMPROBAR
        ========================================
        */

        if (
            followers.size === 0
        ) {

            status.textContent =
                "❌ No hemos podido encontrar tus seguidores.";

            return;

        }


        if (
            following.size === 0
        ) {

            status.textContent =
                "❌ Hemos encontrado seguidores, pero no la lista de cuentas que sigues. Mira la sección de diagnóstico.";

            return;

        }


        /*
        ========================================
        COMPARACIÓN
        ========================================
        */

        notFollowingUsers =
            [...following]
                .filter(
                    username =>
                        !followers.has(username)
                )
                .sort();


        /*
        ========================================
        ESTADÍSTICAS
        ========================================
        */

        followersCount.textContent =
            followers.size;

        followingCount.textContent =
            following.size;

        notFollowingCount.textContent =
            notFollowingUsers.length;


        stats.classList.remove(
            "hidden"
        );

        results.classList.remove(
            "hidden"
        );


        renderUsers();


        status.textContent =
            `✅ Análisis completado. ${notFollowingUsers.length} cuentas no te siguen.`;

    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Error analizando el ZIP.";

        debug.classList.remove(
            "hidden"
        );

        debugContent.innerHTML =
            `<pre>${escapeHtml(
                error.toString()
            )}</pre>`;

    }

});


/* ========================================
   EXTRAER USUARIOS DE JSON
======================================== */

function extractUsernames(data) {

    const usernames =
        new Set();


    function walk(value) {

        if (!value) {
            return;
        }


        /*
        ARRAY
        */

        if (
            Array.isArray(value)
        ) {

            value.forEach(item =>
                walk(item)
            );

            return;
        }


        /*
        OBJETO
        */

        if (
            typeof value === "object"
        ) {


            /*
            FORMATO INSTAGRAM
            */

            if (
                Array.isArray(
                    value.string_list_data
                )
            ) {

                value.string_list_data
                    .forEach(item => {

                        if (
                            item &&
                            typeof item.value === "string"
                        ) {

                            const username =
                                item.value
                                    .trim()
                                    .toLowerCase();


                            if (
                                isValidUsername(
                                    username
                                )
                            ) {

                                usernames.add(
                                    username
                                );

                            }

                        }

                    });

            }


            /*
            CONTINUAR RECORRIENDO
            */

            Object.values(value)
                .forEach(child =>
                    walk(child)
                );

        }

    }


    walk(data);

    return usernames;

}


/* ========================================
   VALIDAR USERNAME
======================================== */

function isValidUsername(username) {

    if (!username) {
        return false;
    }

    if (
        username.length > 40
    ) {
        return false;
    }

    return /^[a-zA-Z0-9._]+$/
        .test(username);

}


/* ========================================
   RENDERIZAR LISTA
======================================== */

function renderUsers() {

    const query =
        search.value
            .trim()
            .toLowerCase();


    userList.innerHTML = "";


    const filtered =
        notFollowingUsers.filter(
            username =>
                username.includes(query)
        );


    filtered.forEach(username => {

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "user";


        const checkbox =
            document.createElement(
                "input"
            );

        checkbox.type =
            "checkbox";

        checkbox.className =
            "userCheckbox";

        checkbox.value =
            username;


        const span =
            document.createElement(
                "span"
            );

        span.textContent =
            "@" + username;


        row.appendChild(
            checkbox
        );

        row.appendChild(
            span
        );


        userList.appendChild(
            row
        );

    });

}


/* ========================================
   BUSCAR
======================================== */

search.addEventListener(
    "input",
    renderUsers
);


/* ========================================
   SELECCIONAR TODOS
======================================== */

selectAll.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".userCheckbox"
            )
            .forEach(
                checkbox =>
                    checkbox.checked = true
            );

    }
);


/* ========================================
   DESELECCIONAR
======================================== */

clearAll.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".userCheckbox"
            )
            .forEach(
                checkbox =>
                    checkbox.checked = false
            );

    }
);


/* ========================================
   ESCAPAR HTML
======================================== */

function escapeHtml(text) {

    return String(text)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ========================================
   SERVICE WORKER
======================================== */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator
                .serviceWorker
                .register(
                    "service-worker.js"
                )
                .catch(error =>
                    console.log(
                        "Service Worker:",
                        error
                    )
                );

        }
    );

}
