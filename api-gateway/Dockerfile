FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace/api-gateway
COPY api-gateway/ ./
RUN chmod +x gradlew \
    && ./gradlew --no-daemon clean bootJar -x test \
    && JAR="$(find build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' | head -n 1)" \
    && test -n "$JAR" \
    && cp "$JAR" /tmp/app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /tmp/app.jar /app/app.jar
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8086} -jar /app/app.jar"]
