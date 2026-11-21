FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace/config-server

COPY config-server/ ./

RUN chmod +x gradlew \
    && ./gradlew --no-daemon clean bootJar -x test \
    && JAR="$(find build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' | head -n 1)" \
    && test -n "$JAR" \
    && cp "$JAR" /tmp/app.jar

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /tmp/app.jar /app/app.jar
COPY --from=build /workspace/config-server/config-repo/ /app/config-repo/

EXPOSE 8888

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8888} -jar /app/app.jar"]
