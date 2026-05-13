import pdf from 'pdf-parse-new';

interface DatosAlumno {
    numCuenta: string | undefined;
    nombre: string | undefined;
    planEstudios: string | undefined;
    promedio: string | undefined;
    creditosTotales: string | undefined;
    aprobadas: string | undefined;
}

export async function procesarYValidarHistorial(dataBuffer: Buffer): Promise<string | null> {
    try {
        const data = await pdf(dataBuffer);
        const texto: string = data.text; 

        const datos: DatosAlumno = {
            numCuenta: texto.match(/NÚMERO DE CUENTA:\s+(\d+)/)?.[1],
            nombre: texto.match(/NOMBRE:\s+([A-Z\s]+)/)?.[1]?.trim(),
            planEstudios: texto.match(/PLAN DE ESTUDIOS:\s+([\d\s\-A-ZÁÉÍÓÚ]+)/)?.[1]?.trim(),
            promedio: texto.match(/PROMEDIO\s+([\d.]+)/)?.[1],
            creditosTotales: texto.match(/TOTALES:\s+\d+\s+de\s+(\d+)/)?.[1],
            aprobadas: texto.match(/APROBADAS:\s+(\d+)/)?.[1]
        };

        const camposObligatorios: { id: keyof DatosAlumno; nombre: string }[] = [
            { id: 'numCuenta', nombre: 'Número de Cuenta' },
            { id: 'nombre', nombre: 'Nombre del Alumno' },
            { id: 'planEstudios', nombre: 'Plan de Estudios' },
            { id: 'promedio', nombre: 'Promedio General' },
            { id: 'aprobadas', nombre: 'Materias Aprobadas' }
        ];

        for (const campo of camposObligatorios) {
            if (!datos[campo.id] || datos[campo.id] === "0.00") {
                throw new Error(`VALIDACIÓN FALLIDA: No se pudo encontrar el dato [${campo.nombre}].`);
            }
        }

        const lineas = texto.split('\n');
        const listaMaterias: string[] = []; 
        const materiaRegex = /^0240\s+\d{4}\s+\d{2}\s+(?:OBL|OPT)\s+(.+?)\s+(\d{1,2})\s+(ORD|EXT)/;

        lineas.forEach(linea => {
            const match = linea.trim().match(materiaRegex);
            if (match) {
                const nombreMateria = match[1].trim();
                const calif = match[2];
                const tipo = match[3];
                listaMaterias.push(`- **${nombreMateria}**: ${calif} (${tipo})`);
            }
        });

        if (listaMaterias.length === 0) {
            throw new Error("VALIDACIÓN FALLIDA: El documento no contiene materias.");
        }

        const markdownFinal = `
            # Historial Académico Validado

            ### Datos del Alumno
            * **Nombre:** ${datos.nombre}
            * **Cuenta:** ${datos.numCuenta} 
            * **Plan:** ${datos.planEstudios} 
            * **Promedio:** ${datos.promedio} 

            ---

            ### Materias
            ${listaMaterias.join('\n')}
        `.trim();

        return markdownFinal;

    } catch (error: unknown) {
        console.error("❌ ERROR DE CARGA:");
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error("Ocurrió un error desconocido durante el parseo.");
        }
        return null;
    }
}