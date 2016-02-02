if defined?(Excon)
  module Excon

    class Connection

      def _httplog_url(datum)
        "#{datum[:scheme]}://#{datum[:host]}:#{datum[:port]}#{datum[:path]}#{datum[:query]}"
      end

      alias_method :orig_request, :request
      def request(params, &block)
        datum = @data.merge(params)
        url = _httplog_url(datum)

        return orig_request(params, &block) unless Binnacle::HttpLogger.allow?(url)

        result = nil
        @binnacle_bm = Benchmark.realtime do
          result = orig_request(params, &block)
        end

        datum[:headers] = @data[:headers].merge(datum[:headers] || {})

        if Binnacle::HttpLogger.allow?(url)
          @binnacle_method = datum[:method]
        end
        result
      end

      alias_method :orig_request_call, :request_call
      def request_call(datum)
        url = _httplog_url(datum)

        if Binnacle::HttpLogger.allow?(url)
          @binnacle_headers = datum[:headers]
          @binnacle_data = datum[:body] # if datum[:method] == :post
          @binnacle_method = datum[:method]
        end
        orig_request_call(datum)
      end

      alias_method :orig_response, :response
      def response(datum={})
        url = _httplog_url(datum)
        return orig_response(datum) unless Binnacle::HttpLogger.allow?(url)

        uri = URI(url)
        url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

        bm = Benchmark.realtime do
          datum = orig_response(datum)
        end
        response = datum[:response]
        headers = response[:headers] || {}

        Binnacle::HttpLogger.signal(url_without_query, @binnacle_method, datum[:host], datum[:port], uri.path, uri.query, response[:status], @binnacle_bm, @binnacle_headers, response[:body], headers['Content-Encoding'], headers['Content-Type'], @binnacle_data)

        datum
      end
    end
  end
end
